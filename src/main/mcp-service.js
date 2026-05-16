const net = require('net');
const path = require('path');
const os = require('os');
const fs = require('fs');

const MCP_PROTOCOL_VERSION = '2024-11-05';
const MAX_BODY_BYTES = 10 * 1024 * 1024;        // 10 MB per note write
const MAX_FRAME_BYTES = 32 * 1024 * 1024;       // hard cap on a single line buffer

// JSON-RPC 2.0 error codes (https://www.jsonrpc.org/specification#error_object)
const RPC_PARSE_ERROR     = -32700;
const RPC_INVALID_REQUEST = -32600;
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INVALID_PARAMS  = -32602;
const RPC_INTERNAL_ERROR  = -32603;

// Tool error sentinel — returned as a tools/call result with isError:true rather
// than as a JSON-RPC error, per MCP convention. Clients display the text to the
// model so it can recover (e.g. "no project open" prompts a different action).
class ToolError extends Error {}

// Tools that mutate project state. Confirm-before-write mode (when enabled)
// prompts the user before any of these execute; read-only tools never prompt.
// list_tags / list_attachments are read-only despite their "list" prefix.
const WRITE_TOOLS = new Set([
  'create_note', 'update_note', 'delete_note', 'rename_note',
  'set_tags', 'add_attachment', 'remove_attachment',
]);

const READ_TOOLS = new Set([
  'list_notes', 'read_note', 'search', 'get_backlinks',
  'list_attachments', 'list_tags',
]);

class McpService {
  constructor({ projectService, linkGraphService, appVersion, log, getPrefs, confirm }) {
    this.projectService = projectService;
    this.linkGraphService = linkGraphService;
    this.appVersion = appVersion || '0.0.0';
    this.log = log || (() => {});

    // Pull live so toggling settings in the running app takes effect on the
    // next tool call, no restart needed.
    this.getPrefs = getPrefs || (() => ({ confirmWrites: false, disabledTools: [] }));
    // Returns 'allow' | 'deny' | 'session'. Default = 'allow' for environments
    // where no UI is attached (CLI smoke tests, headless modes).
    this.confirm = confirm || (async () => 'allow');

    this.tcpServer = null;
    this.socketPath = null;
    this.runtimePath = null;
    this.connections = new Set();
    this.running = false;

    // Session-scoped allow list. "Always allow this tool for this session"
    // adds tool names here. Cleared on stop() so the next project open or
    // app restart returns to prompting.
    this.sessionAllowed = new Set();
  }

  // Exposed so the renderer (via main) can render a settings page that knows
  // which tools are write-side and which are read-only.
  static toolClassification() {
    return {
      read: [...READ_TOOLS],
      write: [...WRITE_TOOLS],
    };
  }

  isRunning() {
    return this.running;
  }

  getSocketPath() {
    return this.socketPath;
  }

  // socket path is process-scoped so two NoteLiner instances do not collide.
  computeSocketPath() {
    if (process.platform === 'win32') {
      return `\\\\?\\pipe\\noteliner-mcp-${process.pid}`;
    }
    return path.join(os.tmpdir(), `noteliner-mcp-${process.pid}.sock`);
  }

  async start(runtimePath) {
    if (this.running) return;
    this.runtimePath = runtimePath;
    this.socketPath = this.computeSocketPath();

    // Stale socket file from a SIGKILLed previous instance would block listen().
    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try { fs.unlinkSync(this.socketPath); } catch { /* ignore */ }
    }

    await new Promise((resolve, reject) => {
      this.tcpServer = net.createServer((socket) => this.handleConnection(socket));
      this.tcpServer.once('error', reject);
      this.tcpServer.listen(this.socketPath, () => {
        this.tcpServer.removeListener('error', reject);
        resolve();
      });
    });

    // chmod 0600 — only the owning user can connect. Named pipes on Windows
    // are user-scoped by default, so this is Unix-only.
    if (process.platform !== 'win32') {
      try { fs.chmodSync(this.socketPath, 0o600); } catch { /* ignore */ }
    }

    this.writeRuntimeFile();
    this.running = true;
    this.log(`[MCP] listening on ${this.socketPath}`);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;

    // Drop session trust — the next start() is a fresh session.
    this.sessionAllowed.clear();

    for (const c of this.connections) {
      try { c.destroy(); } catch { /* ignore */ }
    }
    this.connections.clear();

    await new Promise((resolve) => {
      if (!this.tcpServer) return resolve();
      this.tcpServer.close(() => resolve());
    });
    this.tcpServer = null;

    if (this.socketPath && process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try { fs.unlinkSync(this.socketPath); } catch { /* ignore */ }
    }
    this.removeRuntimeFile();
    this.log('[MCP] stopped');
    this.socketPath = null;
  }

  writeRuntimeFile() {
    if (!this.runtimePath) return;
    const payload = {
      socketPath: this.socketPath,
      pid: process.pid,
      projectPath: this.projectService.projectPath,
      startedAt: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(this.runtimePath, JSON.stringify(payload, null, 2));
    } catch (err) {
      this.log(`[MCP] failed to write runtime file: ${err.message}`);
    }
  }

  removeRuntimeFile() {
    if (this.runtimePath && fs.existsSync(this.runtimePath)) {
      try { fs.unlinkSync(this.runtimePath); } catch { /* ignore */ }
    }
  }

  // --- Connection / framing ---

  handleConnection(socket) {
    this.connections.add(socket);
    let buf = '';

    socket.on('data', (chunk) => {
      buf += chunk.toString('utf-8');
      if (buf.length > MAX_FRAME_BYTES) {
        this.log('[MCP] frame too large; closing connection');
        socket.destroy();
        return;
      }

      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        this.handleMessage(socket, line);
      }
    });

    socket.on('close', () => this.connections.delete(socket));
    socket.on('error', (err) => {
      this.log(`[MCP] socket error: ${err.message}`);
      this.connections.delete(socket);
    });
  }

  send(socket, msg) {
    if (socket.destroyed) return;
    try {
      socket.write(JSON.stringify(msg) + '\n');
    } catch (err) {
      this.log(`[MCP] write failed: ${err.message}`);
    }
  }

  sendError(socket, id, code, message, data) {
    this.send(socket, {
      jsonrpc: '2.0',
      id: id == null ? null : id,
      error: { code, message, ...(data ? { data } : {}) },
    });
  }

  async handleMessage(socket, line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      this.sendError(socket, null, RPC_PARSE_ERROR, 'Parse error');
      return;
    }

    if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      // Notifications without id are allowed; responses (with result/error)
      // are ignored since this side never sends client-bound requests in v1.
      if (msg && (msg.result !== undefined || msg.error !== undefined)) return;
      this.sendError(socket, msg?.id ?? null, RPC_INVALID_REQUEST, 'Invalid Request');
      return;
    }

    const isNotification = msg.id === undefined || msg.id === null;

    try {
      const result = await this.dispatch(msg.method, msg.params || {});
      if (!isNotification) {
        this.send(socket, { jsonrpc: '2.0', id: msg.id, result });
      }
    } catch (err) {
      if (isNotification) return;
      const code = typeof err.rpcCode === 'number' ? err.rpcCode : RPC_INTERNAL_ERROR;
      this.sendError(socket, msg.id, code, err.message || 'Internal error');
    }
  }

  async dispatch(method, params) {
    switch (method) {
      case 'initialize':           return this.handleInitialize(params);
      case 'initialized':          return null; // notification
      case 'notifications/initialized': return null;
      case 'ping':                 return {};
      case 'tools/list':           return this.handleToolsList();
      case 'tools/call':           return this.handleToolsCall(params);
      case 'resources/list':       return this.handleResourcesList();
      case 'resources/read':       return this.handleResourcesRead(params);
      case 'prompts/list':         return this.handlePromptsList();
      case 'prompts/get':          return this.handlePromptsGet(params);
      default: {
        const err = new Error(`Method not found: ${method}`);
        err.rpcCode = RPC_METHOD_NOT_FOUND;
        throw err;
      }
    }
  }

  // --- MCP handshake ---

  handleInitialize() {
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      serverInfo: {
        name: 'noteliner',
        version: this.appVersion,
      },
    };
  }

  // --- Tools ---

  toolDefinitions() {
    return [
      {
        name: 'list_notes',
        description: 'List every note in the open NoteLiner project. Returns id, name, filename, tags, parentId.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'read_note',
        description: 'Read the markdown body of a note by id or by name.',
        inputSchema: {
          type: 'object',
          properties: {
            id:   { type: 'string', description: 'Note id (preferred).' },
            name: { type: 'string', description: 'Note name (case-insensitive).' },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'create_note',
        description: 'Create a new note. Auto-commits to git via the standard project write path.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            body: { type: 'string', description: 'Markdown body. Optional.' },
            tags: { type: 'array', items: { type: 'string' } },
            parentId: { type: 'string', description: 'Optional parent note id for hierarchical placement.' },
          },
          required: ['name'],
          additionalProperties: false,
        },
      },
      {
        name: 'update_note',
        description: 'Replace the markdown body of an existing note. Auto-commits.',
        inputSchema: {
          type: 'object',
          properties: {
            id:   { type: 'string' },
            name: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['body'],
          additionalProperties: false,
        },
      },
      {
        name: 'delete_note',
        description: 'Delete a note. Children of the deleted note are re-parented to its parent.',
        inputSchema: {
          type: 'object',
          properties: {
            id:   { type: 'string' },
            name: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'rename_note',
        description: 'Change the human-visible name of a note. The filename is re-slugged.',
        inputSchema: {
          type: 'object',
          properties: {
            id:      { type: 'string' },
            name:    { type: 'string', description: 'Current name (used when id is absent).' },
            newName: { type: 'string' },
          },
          required: ['newName'],
          additionalProperties: false,
        },
      },
      {
        name: 'set_tags',
        description: 'Replace the tag list on a note.',
        inputSchema: {
          type: 'object',
          properties: {
            id:   { type: 'string' },
            name: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['tags'],
          additionalProperties: false,
        },
      },
      {
        name: 'search',
        description: 'Full-text search across note bodies. Returns hits with line numbers.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            caseSensitive: { type: 'boolean', default: false },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_backlinks',
        description: 'List notes that link to the given note via wikilink syntax.',
        inputSchema: {
          type: 'object',
          properties: {
            id:   { type: 'string' },
            name: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'list_attachments',
        description: 'List attachments on a note.',
        inputSchema: {
          type: 'object',
          properties: {
            id:   { type: 'string' },
            name: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'list_tags',
        description: 'List every distinct tag used across the project, with the count of notes carrying each tag.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'add_attachment',
        description: 'Attach a binary file to a note. Data must be base64-encoded. 30MB limit.',
        inputSchema: {
          type: 'object',
          properties: {
            id:           { type: 'string' },
            name:         { type: 'string' },
            filename:     { type: 'string', description: 'Original filename (used to derive extension and MIME type).' },
            dataBase64:   { type: 'string', description: 'Base64-encoded file contents.' },
          },
          required: ['filename', 'dataBase64'],
          additionalProperties: false,
        },
      },
      {
        name: 'remove_attachment',
        description: 'Remove an attachment from a note by its attachment id.',
        inputSchema: {
          type: 'object',
          properties: {
            id:           { type: 'string', description: 'Note id (preferred).' },
            name:         { type: 'string', description: 'Note name.' },
            attachmentId: { type: 'string' },
          },
          required: ['attachmentId'],
          additionalProperties: false,
        },
      },
    ];
  }

  handleToolsList() {
    return { tools: this.toolDefinitions() };
  }

  async handleToolsCall(params) {
    const { name, arguments: args = {} } = params || {};
    if (!name || typeof name !== 'string') {
      const err = new Error('tools/call requires a "name" string');
      err.rpcCode = RPC_INVALID_PARAMS;
      throw err;
    }

    try {
      await this.preflight(name, args);
      const result = await this.invokeTool(name, args);
      this.log(`[MCP] ${name} ok`);
      return result;
    } catch (err) {
      this.log(`[MCP] ${name} error: ${err.message}`);
      // ToolError surfaces to the model; everything else is wrapped the same
      // way so a stray crash still gives the model a chance to react.
      return {
        content: [{ type: 'text', text: err.message }],
        isError: true,
      };
    }
  }

  // Disabled-tool check + (for writes) interactive confirmation. Throws
  // ToolError to abort the call without running it.
  async preflight(name, args) {
    const prefs = this.getPrefs() || {};
    const disabled = Array.isArray(prefs.disabledTools) ? prefs.disabledTools : [];
    if (disabled.includes(name)) {
      throw new ToolError(`Tool "${name}" is disabled in NoteLiner settings.`);
    }

    if (!WRITE_TOOLS.has(name)) return;
    if (!prefs.confirmWrites) return;
    if (this.sessionAllowed.has(name)) return;

    const summary = this.summarizeToolCall(name, args);
    let decision;
    try {
      decision = await this.confirm({ tool: name, summary, args });
    } catch (err) {
      throw new ToolError(`Confirmation prompt failed: ${err.message}`);
    }

    if (decision === 'deny') {
      throw new ToolError(`User denied the "${name}" call.`);
    }
    if (decision === 'session') {
      this.sessionAllowed.add(name);
      this.log(`[MCP] session-trust granted for "${name}"`);
    }
    // 'allow' falls through.
  }

  // Human-readable one-liner describing what the tool will do. Used in the
  // confirmation dialog and the log so the user has something more digestible
  // than the raw args JSON. Returns a string with no trailing punctuation.
  summarizeToolCall(name, args = {}) {
    switch (name) {
      case 'create_note':
        return `Create note "${args.name || '(unnamed)'}"` +
          (Array.isArray(args.tags) && args.tags.length ? ` with tags [${args.tags.join(', ')}]` : '');
      case 'update_note': {
        const target = args.id || args.name || '(unspecified)';
        const len = typeof args.body === 'string' ? args.body.length : 0;
        return `Update body of "${target}" (${len} chars)`;
      }
      case 'delete_note':
        return `Delete note "${args.id || args.name || '(unspecified)'}"`;
      case 'rename_note':
        return `Rename "${args.id || args.name || '(unspecified)'}" to "${args.newName || '(unspecified)'}"`;
      case 'set_tags':
        return `Set tags on "${args.id || args.name || '(unspecified)'}" to [${(args.tags || []).join(', ')}]`;
      case 'add_attachment':
        return `Attach "${args.filename || '(unspecified)'}" to "${args.id || args.name || '(unspecified)'}"`;
      case 'remove_attachment':
        return `Remove attachment ${args.attachmentId || '(unspecified)'} from "${args.id || args.name || '(unspecified)'}"`;
      default:
        return name;
    }
  }

  async invokeTool(name, args) {
    switch (name) {
      case 'list_notes':       return this.toolListNotes();
      case 'read_note':        return this.toolReadNote(args);
      case 'create_note':      return this.toolCreateNote(args);
      case 'update_note':      return this.toolUpdateNote(args);
      case 'delete_note':      return this.toolDeleteNote(args);
      case 'rename_note':      return this.toolRenameNote(args);
      case 'set_tags':         return this.toolSetTags(args);
      case 'search':           return this.toolSearch(args);
      case 'get_backlinks':    return this.toolGetBacklinks(args);
      case 'list_attachments': return this.toolListAttachments(args);
      case 'list_tags':        return this.toolListTags();
      case 'add_attachment':   return this.toolAddAttachment(args);
      case 'remove_attachment': return this.toolRemoveAttachment(args);
      default: throw new ToolError(`Unknown tool: ${name}`);
    }
  }

  // --- Tool helpers ---

  requireProject() {
    if (!this.projectService.projectPath || !this.projectService.index) {
      throw new ToolError('No project is open in NoteLiner.');
    }
  }

  // id wins over name when both are supplied. name match is case-insensitive
  // so AI agents can refer to notes the way they appear in the UI.
  resolveEntry({ id, name }) {
    this.requireProject();
    const files = this.projectService.index.files;
    if (id) {
      const entry = files.find(f => f.id === id);
      if (!entry) throw new ToolError(`No note with id "${id}".`);
      return entry;
    }
    if (name) {
      const target = name.toLowerCase();
      const entry = files.find(f => f.name.toLowerCase() === target);
      if (!entry) throw new ToolError(`No note named "${name}".`);
      return entry;
    }
    throw new ToolError('Provide either "id" or "name".');
  }

  // Prompts use a single `note` argument that may be either id or name. This
  // helper tries id first (cheap, stable), then falls back to a case-insensitive
  // name lookup. Unlike resolveEntry, the input is opaque — we don't know which
  // shape the user supplied.
  resolveByIdOrName(value) {
    this.requireProject();
    if (!value || typeof value !== 'string') throw new ToolError('Note reference required.');
    const files = this.projectService.index.files;
    const byId = files.find(f => f.id === value);
    if (byId) return byId;
    const target = value.toLowerCase();
    const byName = files.find(f => f.name.toLowerCase() === target);
    if (byName) return byName;
    throw new ToolError(`No note matching "${value}".`);
  }

  textResult(text) {
    return { content: [{ type: 'text', text }], isError: false };
  }

  jsonResult(value) {
    return this.textResult(JSON.stringify(value, null, 2));
  }

  // --- Tool implementations ---

  toolListNotes() {
    this.requireProject();
    const notes = this.projectService.index.files.map(f => ({
      id: f.id,
      name: f.name,
      filename: f.filename,
      tags: f.tags || [],
      parentId: f.parentId || null,
    }));
    this.log(`[MCP] list_notes -> ${notes.length} results`);
    return this.jsonResult(notes);
  }

  async toolReadNote(args) {
    const entry = this.resolveEntry(args);
    const body = await this.projectService.readFile(entry.filename);
    this.log(`[MCP] read_note id=${entry.id} bytes=${body.length}`);
    return this.textResult(body);
  }

  async toolCreateNote({ name, body, tags, parentId }) {
    this.requireProject();
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ToolError('"name" is required and must be a non-empty string.');
    }
    if (body != null && typeof body !== 'string') {
      throw new ToolError('"body" must be a string when provided.');
    }
    if (body != null && Buffer.byteLength(body, 'utf-8') > MAX_BODY_BYTES) {
      throw new ToolError(`Body exceeds ${Math.floor(MAX_BODY_BYTES / 1024 / 1024)}MB limit.`);
    }

    const entry = await this.projectService.createFile(
      name.trim(),
      Array.isArray(tags) ? tags : [],
      body != null ? { body } : {}
    );

    // createFile pushes the entry with parentId:null. Reparent in-place and
    // persist by re-saving the index (no helper exists in ProjectService).
    if (parentId) {
      const parent = this.projectService.index.files.find(f => f.id === parentId);
      if (!parent) throw new ToolError(`No parent note with id "${parentId}".`);
      entry.parentId = parentId;
      await this.projectService.saveIndex(this.projectService.index);
    }

    this.log(`[MCP] create_note name="${name}" -> id=${entry.id}`);
    return this.textResult(`Created note "${entry.name}" (id: ${entry.id}, filename: ${entry.filename})`);
  }

  async toolUpdateNote({ id, name, body }) {
    if (typeof body !== 'string') {
      throw new ToolError('"body" is required and must be a string.');
    }
    if (Buffer.byteLength(body, 'utf-8') > MAX_BODY_BYTES) {
      throw new ToolError(`Body exceeds ${Math.floor(MAX_BODY_BYTES / 1024 / 1024)}MB limit.`);
    }
    const entry = this.resolveEntry({ id, name });
    await this.projectService.writeFile(entry.filename, body);
    // Re-scan links so backlinks stay consistent for the next get_backlinks call.
    if (this.linkGraphService) await this.linkGraphService.scanFile(entry.id);
    this.log(`[MCP] update_note id=${entry.id} bytes=${body.length}`);
    return this.textResult(`Updated note "${entry.name}" (${body.length} chars).`);
  }

  async toolDeleteNote(args) {
    const entry = this.resolveEntry(args);
    await this.projectService.deleteFile(entry.id);
    if (this.linkGraphService) {
      this.linkGraphService.removeFile(entry.id);
      await this.linkGraphService.rebuild();
    }
    this.log(`[MCP] delete_note id=${entry.id}`);
    return this.textResult(`Deleted note "${entry.name}".`);
  }

  async toolRenameNote({ id, name, newName }) {
    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      throw new ToolError('"newName" is required.');
    }
    const entry = this.resolveEntry({ id, name });
    const updated = await this.projectService.renameFile(entry.id, newName.trim());
    if (this.linkGraphService) await this.linkGraphService.rebuild();
    this.log(`[MCP] rename_note id=${entry.id} -> "${newName}"`);
    return this.textResult(`Renamed to "${updated.name}" (filename: ${updated.filename}).`);
  }

  async toolSetTags({ id, name, tags }) {
    if (!Array.isArray(tags)) throw new ToolError('"tags" must be an array.');
    const entry = this.resolveEntry({ id, name });
    entry.tags = tags.filter(t => typeof t === 'string');
    await this.projectService.saveIndex(this.projectService.index);
    this.log(`[MCP] set_tags id=${entry.id} count=${entry.tags.length}`);
    return this.textResult(`Set tags on "${entry.name}": [${entry.tags.join(', ')}]`);
  }

  toolSearch({ query, caseSensitive }) {
    this.requireProject();
    if (!query || typeof query !== 'string') throw new ToolError('"query" is required.');
    const hits = this.projectService.search(query, { caseSensitive: !!caseSensitive });
    this.log(`[MCP] search "${query}" -> ${hits.length} files`);
    return this.jsonResult(hits);
  }

  toolGetBacklinks(args) {
    const entry = this.resolveEntry(args);
    if (!this.linkGraphService) throw new ToolError('Link graph unavailable.');
    const links = this.linkGraphService.getBacklinkSnippets(entry.id);
    this.log(`[MCP] get_backlinks id=${entry.id} -> ${links.length} sources`);
    return this.jsonResult(links);
  }

  toolListAttachments(args) {
    const entry = this.resolveEntry(args);
    return this.jsonResult(entry.attachments || []);
  }

  toolListTags() {
    this.requireProject();
    // Build a tag -> { count, noteIds } histogram. Tags are case-preserving
    // (the user's casing wins) and de-duplicated case-sensitively so "Todo"
    // and "todo" remain distinct — same convention as the renderer's TagsPane.
    const histogram = new Map();
    for (const file of this.projectService.index.files) {
      for (const tag of file.tags || []) {
        if (!histogram.has(tag)) histogram.set(tag, { tag, count: 0, noteIds: [] });
        const entry = histogram.get(tag);
        entry.count += 1;
        entry.noteIds.push(file.id);
      }
    }
    const tags = [...histogram.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    this.log(`[MCP] list_tags -> ${tags.length} tags`);
    return this.jsonResult(tags);
  }

  async toolAddAttachment({ id, name, filename, dataBase64 }) {
    if (!filename || typeof filename !== 'string') throw new ToolError('"filename" is required.');
    if (!dataBase64 || typeof dataBase64 !== 'string') throw new ToolError('"dataBase64" is required.');
    // Reject any path component in the original filename — ProjectService only
    // uses it to derive an extension, but defense in depth never hurts.
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new ToolError('Invalid filename — must not contain path separators.');
    }
    const entry = this.resolveEntry({ id, name });
    let buffer;
    try {
      buffer = Buffer.from(dataBase64, 'base64');
    } catch {
      throw new ToolError('Invalid base64 in "dataBase64".');
    }
    // ProjectService.addAttachment enforces the 30MB cap and writes through
    // the same auto-commit path as user-driven attachments. It accepts both
    // ArrayBuffer (the renderer path via IPC structured clone) and Buffer
    // (us) because it uses .byteLength + Buffer.from(...) on the value.
    const attachment = await this.projectService.addAttachment(entry.id, buffer, filename);
    this.log(`[MCP] add_attachment id=${entry.id} file="${filename}" bytes=${buffer.length}`);
    return this.jsonResult(attachment);
  }

  async toolRemoveAttachment({ id, name, attachmentId }) {
    if (!attachmentId || typeof attachmentId !== 'string') throw new ToolError('"attachmentId" is required.');
    const entry = this.resolveEntry({ id, name });
    const exists = (entry.attachments || []).some(a => a.id === attachmentId);
    if (!exists) throw new ToolError(`No attachment "${attachmentId}" on note "${entry.name}".`);
    await this.projectService.removeAttachment(entry.id, attachmentId);
    this.log(`[MCP] remove_attachment id=${entry.id} attachment=${attachmentId}`);
    return this.textResult(`Removed attachment ${attachmentId} from "${entry.name}".`);
  }

  // --- Resources ---

  handleResourcesList() {
    if (!this.projectService.projectPath || !this.projectService.index) {
      return { resources: [] };
    }
    const resources = [
      {
        uri: 'noteliner://index',
        name: 'Project index',
        description: 'noteliner.json — id, name, filename, tags, parentId, attachments for every note.',
        mimeType: 'application/json',
      },
    ];
    for (const file of this.projectService.index.files) {
      resources.push({
        uri: `noteliner://note/${file.id}`,
        name: file.name,
        description: `Markdown body of "${file.name}".`,
        mimeType: 'text/markdown',
      });
    }
    return { resources };
  }

  async handleResourcesRead({ uri }) {
    if (!uri || typeof uri !== 'string') {
      const err = new Error('"uri" is required.');
      err.rpcCode = RPC_INVALID_PARAMS;
      throw err;
    }
    this.requireProject();

    if (uri === 'noteliner://index') {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(this.projectService.index, null, 2),
        }],
      };
    }

    const noteMatch = uri.match(/^noteliner:\/\/note\/([^/]+)$/);
    if (noteMatch) {
      const entry = this.projectService.index.files.find(f => f.id === noteMatch[1]);
      if (!entry) throw new ToolError(`No note with id "${noteMatch[1]}".`);
      const body = await this.projectService.readFile(entry.filename);
      return {
        contents: [{ uri, mimeType: 'text/markdown', text: body }],
      };
    }

    const attMatch = uri.match(/^noteliner:\/\/attachment\/(.+)$/);
    if (attMatch) {
      // Reject anything that could escape _attachments/. The bare-filename
      // contract matches how attachments are stored on disk.
      const filename = decodeURIComponent(attMatch[1]);
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        throw new ToolError('Invalid attachment filename.');
      }
      const filePath = this.projectService.getAttachmentPath(filename);
      if (!fs.existsSync(filePath)) throw new ToolError('Attachment not found.');
      const data = fs.readFileSync(filePath);
      return {
        contents: [{
          uri,
          mimeType: 'application/octet-stream',
          blob: data.toString('base64'),
        }],
      };
    }

    throw new ToolError(`Unknown resource URI: ${uri}`);
  }

  // --- Prompts ---
  //
  // Prompts are user-controlled templates (typically surfaced in the MCP
  // client as slash commands). They return a `messages` array the model
  // consumes. Prompts that embed project data (e.g. summarize_note) fetch
  // server-side so the client doesn't have to chain tool calls first.

  promptDefinitions() {
    return [
      {
        name: 'daily_note',
        description: 'Draft a daily journal note for today (or a given date).',
        arguments: [
          { name: 'date', description: 'ISO date like 2026-05-16. Defaults to today.', required: false },
          { name: 'topic', description: 'Optional focus or theme for the day.', required: false },
        ],
      },
      {
        name: 'meeting_note',
        description: 'Draft a meeting note with attendees, agenda, and action items.',
        arguments: [
          { name: 'topic', description: 'Meeting topic or title.', required: true },
          { name: 'attendees', description: 'Comma-separated list of attendees.', required: false },
        ],
      },
      {
        name: 'summarize_note',
        description: 'Summarize an existing note. Provide its id or name.',
        arguments: [
          { name: 'note', description: 'Note id or name (case-insensitive).', required: true },
        ],
      },
      {
        name: 'link_suggestions',
        description: 'Suggest wikilink targets to add to a note, based on its content and the rest of the project.',
        arguments: [
          { name: 'note', description: 'Note id or name (case-insensitive).', required: true },
        ],
      },
    ];
  }

  handlePromptsList() {
    return { prompts: this.promptDefinitions() };
  }

  async handlePromptsGet(params) {
    const { name, arguments: args = {} } = params || {};
    const prompt = this.promptDefinitions().find(p => p.name === name);
    if (!prompt) {
      const err = new Error(`Unknown prompt: ${name}`);
      err.rpcCode = RPC_INVALID_PARAMS;
      throw err;
    }

    // Required-args validation — clients should send these but the spec
    // doesn't enforce it, so we do.
    for (const arg of prompt.arguments || []) {
      if (arg.required && (args[arg.name] == null || args[arg.name] === '')) {
        const err = new Error(`Prompt "${name}" requires argument "${arg.name}".`);
        err.rpcCode = RPC_INVALID_PARAMS;
        throw err;
      }
    }

    const messages = await this.buildPromptMessages(name, args);
    this.log(`[MCP] prompts/get name=${name}`);
    return { description: prompt.description, messages };
  }

  async buildPromptMessages(name, args) {
    switch (name) {
      case 'daily_note': {
        const date = (args.date && String(args.date)) || new Date().toISOString().slice(0, 10);
        const topic = args.topic ? `\n\nFocus for the day: ${args.topic}` : '';
        return [{
          role: 'user',
          content: {
            type: 'text',
            text:
              `Draft a NoteLiner daily journal note for ${date}.\n\n` +
              `Format the note as Markdown with an H1 title \`# Daily ${date}\`, then sections for ` +
              `**Highlights**, **Did**, **Next**, and **Notes**. Keep prose terse — bullets, not paragraphs.${topic}\n\n` +
              `When ready, call the \`create_note\` tool with name="Daily ${date}" and the drafted body.`,
          },
        }];
      }

      case 'meeting_note': {
        const topic = String(args.topic);
        const attendees = args.attendees ? `\n\nAttendees: ${args.attendees}` : '';
        return [{
          role: 'user',
          content: {
            type: 'text',
            text:
              `Draft a NoteLiner meeting note titled "${topic}".${attendees}\n\n` +
              `Use this structure:\n` +
              `# ${topic}\n` +
              `**Date:** YYYY-MM-DD\n` +
              `**Attendees:** ...\n\n` +
              `## Agenda\n- ...\n\n## Discussion\n- ...\n\n## Decisions\n- ...\n\n## Action items\n- [ ] owner — task\n\n` +
              `When ready, call the \`create_note\` tool with name="${topic}" and the drafted body, tagged with ["meeting"].`,
          },
        }];
      }

      case 'summarize_note': {
        // Server-side fetch keeps the prompt self-contained — the client
        // doesn't have to make a tools/call round-trip before sampling.
        const entry = this.resolveByIdOrName(args.note);
        const body = await this.projectService.readFile(entry.filename);
        return [{
          role: 'user',
          content: {
            type: 'text',
            text:
              `Summarize the NoteLiner note "${entry.name}" (id: ${entry.id}).\n\n` +
              `Produce a 3-5 sentence summary, followed by a bullet list of the key entities, decisions, ` +
              `or open questions mentioned.\n\n` +
              `--- BEGIN NOTE BODY ---\n${body}\n--- END NOTE BODY ---`,
          },
        }];
      }

      case 'link_suggestions': {
        const entry = this.resolveByIdOrName(args.note);
        const body = await this.projectService.readFile(entry.filename);
        const allNames = (this.projectService.index?.files || [])
          .filter(f => f.id !== entry.id)
          .map(f => f.name);
        return [{
          role: 'user',
          content: {
            type: 'text',
            text:
              `For the NoteLiner note "${entry.name}", suggest wikilinks ([[Other Note Name]]) that ` +
              `would be useful to add to its body, drawn from the list of existing notes below.\n\n` +
              `Return a short Markdown list. For each suggestion include: the existing note name, the ` +
              `passage in the source that should link to it, and a one-sentence justification. Do not ` +
              `invent notes that aren't on the list.\n\n` +
              `--- EXISTING NOTES (${allNames.length}) ---\n${allNames.map(n => `- ${n}`).join('\n')}\n\n` +
              `--- SOURCE NOTE BODY ---\n${body}`,
          },
        }];
      }

      default: {
        const err = new Error(`Unknown prompt: ${name}`);
        err.rpcCode = RPC_INVALID_PARAMS;
        throw err;
      }
    }
  }
}

module.exports = { McpService, WRITE_TOOLS, READ_TOOLS };
