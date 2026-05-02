# MCP Server — Implementation Plan

## Overview

Expose NoteLiner project data to AI assistants by running a [Model Context
Protocol](https://modelcontextprotocol.io) server inside the Electron main
process. An external MCP client (Claude Code, Claude Desktop, Cursor, etc.)
connects, lists notes, reads contents, searches, and writes new notes — and
NoteLiner's existing auto-commit machinery makes every AI-driven write a real
git commit.

This is the "AI-native vault" capability that Tolaria advertises and which the
comparison report flagged as the highest-leverage backlog item. It complements
`plan-ai-integration.md` (subprocess-CLI panel) rather than replacing it: the
panel is for in-app prompting; the MCP server is for power users running an
AI alongside NoteLiner.

## Goals

1. A NoteLiner project becomes a first-class MCP data source — list, read,
   search, create, update, tag — through structured tools rather than raw
   filesystem access.
2. Writes go through `ProjectService` so `noteliner.json` and git stay
   consistent. AI-generated files appear in the FILES pane and get committed
   exactly like user-created files.
3. The server is **opt-in**, runs only when a project is open, and exposes
   only the currently-open project (no ambient access to other repos).
4. Default transport is **stdio**, because every MCP client supports it and
   it sidesteps localhost port collisions and CORS.

## Current State

- **No MCP code exists.** No `@modelcontextprotocol/sdk` dependency.
- **`ProjectService`** (`src/main/project-service.js`) owns the index and is
  the only correct write path: `createFile` (l. 127), `writeFile` (l. 120),
  `deleteFile`, `renameFile`, plus `addAttachment`, `setTags`. Auto-commit
  fires from inside these methods via `gitService.commit` +
  `gitService.schedulePush` (`project-service.js:122-124`).
- **`SearchService`** is exposed via the `search:query` IPC handler (see
  `preload.js:48`). The MCP server can call the same code path.
- **`LinkGraphService`** (`src/main/link-graph-service.js`) provides
  backlinks, used today for the Backlinks pane.
- **Personal config lives in `userData`**, not in the project. MCP server
  enable/disable + transport settings should follow that pattern.

## Architecture

```
┌────────────────────────────────────────────┐
│ Electron main process                      │
│                                            │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │ MCP Server   │───►│ ProjectService   │  │
│  │ (in-process) │    │  GitService      │  │
│  │              │    │  LinkGraph       │  │
│  └──────┬───────┘    │  SearchService   │  │
│         │            └──────────────────┘  │
└─────────┼──────────────────────────────────┘
          │ stdio (or local Unix/named pipe)
          │
┌─────────▼─────────────────────────────────┐
│ External MCP client (Claude Code, etc.)   │
└───────────────────────────────────────────┘
```

The server runs **in-process** in main, so it shares `ProjectService` state
directly — no IPC shim, no second source of truth. The transport is the
process boundary the MCP client connects across.

### Why not a separate Node process?

A separate process would need its own copy of the index, its own git lock
discipline, and its own way to learn when the user switches projects. In
in-process is simpler and avoids the "AI wrote to a stale index" failure
mode. The cost is that closing NoteLiner stops the server — acceptable.

### Transport choice

Default: **stdio**. The MCP client launches a NoteLiner helper binary which
forwards traffic into the running NoteLiner instance over a local socket
(Unix domain socket on macOS/Linux, named pipe on Windows). The helper is
necessary because Electron's main process is not designed to be a child of an
arbitrary client.

```
MCP client ──spawns──► noteliner-mcp-bridge ──ipc──► NoteLiner main
            stdio                            socket
```

`noteliner-mcp-bridge` is a tiny standalone Node script (~50 lines) shipped
alongside the app. It speaks JSON-RPC over stdio and proxies frames to the
local socket NoteLiner listens on while a project is open.

## Tools Exposed

Initial tool set (MCP "tools" = function calls the model can make):

| Tool | Purpose |
|---|---|
| `list_notes` | Return all notes: `[{id, name, filename, tags, parentId}]` |
| `read_note` | Read note body by `id` or `name` |
| `create_note` | Create a new note with name, body, optional tags, optional parent |
| `update_note` | Replace body of an existing note (auto-commits) |
| `delete_note` | Delete a note |
| `rename_note` | Change the human-visible name (filename auto-reslugged) |
| `set_tags` | Replace the tag list on a note |
| `search` | Full-text search; reuse `searchService.query` |
| `get_backlinks` | List notes linking *into* a given note |
| `list_attachments` | List attachments on a note |

Resources (MCP "resources" = readable URIs):

| URI scheme | Returns |
|---|---|
| `noteliner://index` | The full `noteliner.json` (read-only view) |
| `noteliner://note/{id}` | Markdown body of a single note |
| `noteliner://attachment/{filename}` | Binary contents of an attachment |

Tool design rule: **every tool that mutates state goes through
`ProjectService`**, never `fs` directly. That guarantees the index, git, and
link graph stay consistent.

## Implementation Steps

### Step 1: Add the MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

The SDK provides `Server` (tool/resource registration) plus a generic
`StdioServerTransport`. We will *not* use the stdio transport directly in the
main process; we will use a custom `SocketServerTransport` that listens on a
local socket. The bridge script uses the SDK's stdio transport to talk to
the client.

### Step 2: Create the MCP service

**New file:** `src/main/mcp-service.js`

```js
const net = require('net');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Server } = require('@modelcontextprotocol/sdk/server');

class McpService {
  constructor(projectService, gitService, searchService, linkGraphService) {
    this.projectService = projectService;
    // ... store deps
    this.server = null;
    this.socketPath = null;
    this.connections = new Set();
  }

  async start() {
    this.socketPath = this.computeSocketPath();
    if (fs.existsSync(this.socketPath)) fs.unlinkSync(this.socketPath);

    const server = new Server({ name: 'noteliner', version: APP_VERSION }, {
      capabilities: { tools: {}, resources: {} }
    });
    this.registerTools(server);
    this.registerResources(server);

    this.tcpServer = net.createServer((socket) => {
      this.connections.add(socket);
      const transport = new SocketServerTransport(socket);
      server.connect(transport);
      socket.on('close', () => this.connections.delete(socket));
    });
    this.tcpServer.listen(this.socketPath);
    this.server = server;
  }

  async stop() {
    for (const c of this.connections) c.destroy();
    this.tcpServer?.close();
    if (this.socketPath && fs.existsSync(this.socketPath)) {
      try { fs.unlinkSync(this.socketPath); } catch {}
    }
  }

  computeSocketPath() {
    if (process.platform === 'win32') {
      return `\\\\?\\pipe\\noteliner-mcp-${process.pid}`;
    }
    return path.join(os.tmpdir(), `noteliner-mcp-${process.pid}.sock`);
  }

  registerTools(server) {
    server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'list_notes',
          description: 'List every note in the open project.',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'read_note',
          description: 'Read the body of a note by id or name.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        },
        // ... other tools
      ]
    }));

    server.setRequestHandler('tools/call', async (req) => {
      const { name, arguments: args } = req.params;
      switch (name) {
        case 'list_notes': return this.handleListNotes();
        case 'read_note': return this.handleReadNote(args);
        case 'create_note': return this.handleCreateNote(args);
        // ...
        default: throw new Error(`Unknown tool: ${name}`);
      }
    });
  }
}
```

### Step 3: Lifecycle in main.js

In `src/main/main.js`:

- On `project:open` and `project:init` success: if MCP enabled in user prefs,
  call `mcpService.start()`.
- On `project:close` and on `app.on('before-quit')`: call `mcpService.stop()`.
- Write the active socket path to
  `{userData}/mcp-runtime.json: { socketPath, pid, projectPath }` so the
  bridge script can find it.

### Step 4: The bridge binary

**New file:** `bin/noteliner-mcp-bridge.js` (entry in `package.json` `bin`)

```js
#!/usr/bin/env node
const fs = require('fs');
const net = require('net');
const path = require('path');
const os = require('os');

const userData = process.env.NOTELINER_USERDATA
  || path.join(os.homedir(), '.config', 'noteliner');  // platform-resolve in real impl
const runtimePath = path.join(userData, 'mcp-runtime.json');

if (!fs.existsSync(runtimePath)) {
  process.stderr.write('NoteLiner is not running or no project is open.\n');
  process.exit(2);
}
const { socketPath } = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));

const sock = net.connect(socketPath);
sock.on('error', (e) => { process.stderr.write(`bridge: ${e.message}\n`); process.exit(1); });

process.stdin.pipe(sock);
sock.pipe(process.stdout);
```

The MCP client config (e.g. Claude Code's `.mcp.json` or Claude Desktop's
config) launches this script:

```json
{
  "mcpServers": {
    "noteliner": { "command": "noteliner-mcp-bridge" }
  }
}
```

### Step 5: Tool handlers

Each handler is a thin adapter to `ProjectService`. Example:

```js
async handleCreateNote({ name, body, tags, parentId }) {
  if (!this.projectService.projectPath) {
    throw new Error('No project is open in NoteLiner.');
  }
  const entry = await this.projectService.createFile(name, tags || [], { body });
  if (parentId) await this.projectService.reparent(entry.id, parentId);
  return {
    content: [{ type: 'text', text: `Created note "${name}" (id: ${entry.id})` }]
  };
}
```

Auto-commit is already baked into `createFile`, so the AI's writes flow into
git on the same code path as user-driven writes.

### Step 6: Settings UI

Add an **MCP** section to `SettingsModal.svelte`:

- **Enable MCP server** — checkbox. Default: off.
- **Socket path** — display only (helpful for debugging).
- **Bridge command** — copy-button block showing the JSON snippet to paste
  into the MCP client's config file, with the resolved bridge path.
- **Status** — running / stopped / no project open.

Stored in `{userData}/ui-preferences.json`.

### Step 7: Logging

Log every MCP tool call to the existing Log panel:

```
[MCP] list_notes -> 47 results
[MCP] create_note name="Q3 Plan" -> id=abc...
[MCP] update_note id=abc... bytes=2,341
```

This is the user's only window into "what did the AI just do." It is
non-negotiable for trust.

## Security Considerations

- **Socket access = full project access.** On Unix, set the socket file mode
  to `0600` so only the running user can connect. On Windows, named pipes
  default to user-only ACL — verify.
- **No remote transport.** Never bind a TCP port. Only Unix socket / named
  pipe / stdio bridge. (If a future user *really* wants TCP, they can add it
  themselves; we don't ship it.)
- **One project at a time.** `mcpService` only ever exposes
  `projectService.projectPath`. Closing the project tears down the server
  before opening another, so a stale connection cannot cross projects.
- **Confirm on destructive ops?** First cut: no — the AI is treated as
  trusted (the user installed and launched it). Add an `mcp.requireConfirm`
  preference later if user research shows demand. Git history is the safety
  net for accidental writes.
- **Path traversal.** `read_note` / `update_note` resolve to filenames via
  the index — never accept raw paths. `noteliner://attachment/{filename}`
  rejects anything containing `..` or path separators, and resolves only
  inside `_attachments/`.
- **Body size cap.** Reject `update_note` / `create_note` payloads above
  10 MB. Same MIME-style cap as attachments (30 MB).
- **Rate limiting.** None in v1. Revisit if a runaway agent is observed.

## Edge Cases

- **No project open:** Tool calls return a structured error. The bridge
  itself succeeds — clients can still call `tools/list`, but every mutating
  tool replies "no project open."
- **Project switched mid-session:** `mcpService.stop()` runs before
  `start()` for the new project. Existing connections drop; clients
  reconnect transparently via the bridge on next call.
- **Multiple NoteLiner instances:** The socket path includes `process.pid`,
  so two running instances do not collide. The bridge picks whichever
  instance most recently wrote `mcp-runtime.json`. Document this behavior;
  do not try to be clever about multi-instance routing.
- **Concurrent writes:** `ProjectService` is single-threaded inside main —
  every IPC call serializes. MCP calls land on the same event loop, so
  there is no extra locking required. The auto-commit debouncer is the
  only place to watch: a flurry of MCP writes coalesces into one commit,
  which is fine.
- **Renamed note while AI was reading:** AI gets the old `id` → new
  filename mapping transparently because `id` is stable; `name` may have
  changed, which is the AI's problem to detect.

## Testing

1. Manual smoke: enable MCP, configure Claude Code with the bridge,
   ask "list my notes" → see all notes.
2. Ask Claude to create a plan in `docs/plans/` — file appears in the FILES
   pane within a second; git log shows the commit.
3. Search via `search` tool returns the same hits as the in-app Search pane
   for the same query.
4. Stop NoteLiner mid-MCP-call — bridge process exits cleanly, client gets a
   transport error rather than hanging.
5. Open project A, run a tool, switch to project B, run the same tool —
   results reflect B's content, not A's (verifies project-switch teardown).
6. Kill NoteLiner with SIGKILL → restart → the stale socket file does not
   prevent startup (cleanup-on-start handles this).

## Out of Scope (V1)

- **Prompts** (MCP `prompts/list` / `prompts/get`) — useful later for
  shipping pre-canned templates ("write a meeting note for today") but not
  required to ship the data layer.
- **Sampling** (server asks the client to call the model). Not needed for a
  data-source-style server.
- **OAuth / multi-user.** NoteLiner is single-user.
- **Remote MCP** (HTTP transport with TLS). Out of scope; would require auth
  we don't have.
- **Tool: `git_log`, `git_diff`, `commit_now`.** Could be useful but
  duplicates what the AI's own shell access already provides.
- **Streaming partial results** for large search queries. Return up to N
  hits; client can paginate with offset.

## Phasing

**v1 (this plan):** Read tools (`list_notes`, `read_note`, `search`,
`get_backlinks`) + create/update/delete + bridge + settings UI. Stdio bridge
to a local socket. Logged to the Log panel.

**v2:** Tag tools (`set_tags`, `list_tags`), attachment tools, prompts.

**v3:** Optional confirm-before-write mode for destructive ops. Per-tool
allow/deny in settings.

**v4:** Inline MCP-driven AI panel inside NoteLiner that uses *its own*
server + a hosted model — a self-contained AI experience without the
external-CLI requirement of `plan-ai-integration.md` Option A.

## Rollout

No schema migration. Default-off. First-time enable shows a one-screen
walkthrough explaining the bridge and offering to copy the MCP-client config
snippet to clipboard.
