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

class McpService {
  constructor({ projectService, linkGraphService, appVersion, log }) {
    this.projectService = projectService;
    this.linkGraphService = linkGraphService;
    this.appVersion = appVersion || '0.0.0';
    this.log = log || (() => {});

    this.tcpServer = null;
    this.socketPath = null;
    this.runtimePath = null;
    this.connections = new Set();
    this.running = false;
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
}

module.exports = { McpService };
