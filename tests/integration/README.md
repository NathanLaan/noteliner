# Integration tests

Node-driven integration tests that don't need Electron or a browser. They
exercise the MCP server bridge end-to-end by spawning the real
`bin/noteliner-mcp-bridge.js` as a child process and driving it with a
synthetic JSON-RPC client — the same wire path a real MCP client
(Claude Code, Claude Desktop, Cursor) uses.

## Running

```
npm run test:mcp
```

Requires `git` on PATH. Run from the repo root.

## What's covered (items 1–6 from the MCP plan's Testing section)

| Plan item | Automated? |
|---|---|
| 1. Bridge handshake + `list_notes` returns seeded notes | yes |
| 2. `create_note` via bridge writes the .md, updates index, commits to git | yes (backend half — see manual checklist below for FILES-pane refresh) |
| 3. MCP `search` returns identical hits to in-app `ProjectService.search` | yes |
| 4. Mid-call service stop → bridge exits cleanly, no hang | yes |
| 5. Project A → project B switch → tool results reflect B, not A | yes |
| 6. Stale socket file from a SIGKILLed instance → next start cleans up | yes (skipped on Windows — named pipes auto-clean) |

## What still needs a human + a real MCP client

The automated test drives the bridge directly, so it covers protocol
correctness and on-disk + git side effects. It does NOT cover anything
that requires the running Electron renderer to react. Run the checklist
below against a real Claude Code (or Claude Desktop) once before any
MCP-related release:

1. **Enable + walkthrough**: Settings → MCP → toggle "Enable MCP server".
   Verify the walkthrough appears, the copy button works, and clicking
   "Enable MCP server" inside the walkthrough turns on the toggle.
2. **Client config + first call**: paste the snippet from Settings → MCP →
   Client Configuration into your client's config, restart the client,
   ask it to list notes. Verify the response matches the FILES pane.
3. **FILES-pane refresh**: ask the client to create a note. Confirm the
   new file appears in the FILES pane. **Known gap**: as of this writing,
   the renderer does not auto-refresh when MCP mutates the index; the
   user must reopen the project to see new notes. A future enhancement
   should emit a `project:index-changed` IPC after MCP writes so the
   renderer can reload `projectState`.
4. **Confirm-before-write**: Settings → MCP → tick "Ask before write
   operations". Ask the client to update a note. Verify the
   confirmation modal appears and that Deny / Allow once / Allow for
   session behave as labelled.
5. **Project switch**: with the client connected, switch NoteLiner to a
   different project. Verify the next tool call from the client reflects
   the new project, not the old one.
6. **SIGKILL recovery**: `kill -9` the NoteLiner process while MCP is on.
   Relaunch NoteLiner. Confirm it starts and that MCP comes up again
   without manual socket cleanup.

## Why this is its own runner

The Playwright suite under `tests/e2e/` boots an Electron app — heavy,
slow, and not the right tool for testing a Node service. This test runs
in plain Node, no Electron required, completing in under five seconds
on a typical laptop.
