#!/usr/bin/env node
// noteliner-mcp-bridge
//
// Tiny stdio<->socket forwarder. MCP clients (Claude Code, Claude Desktop,
// Cursor, etc.) spawn this script and speak newline-delimited JSON-RPC 2.0
// over its stdin/stdout. This process locates the running NoteLiner
// instance via {userData}/mcp-runtime.json and pipes bytes through to its
// local Unix domain socket (or Windows named pipe).
//
// Both sides of the pipe use the same wire format, so this script is a
// pure byte-pump — it never parses MCP itself.

const fs = require('fs');
const net = require('net');
const path = require('path');
const os = require('os');

function defaultUserData() {
  // Mirrors Electron's app.getPath('userData') resolution for "NoteLiner".
  // Set NOTELINER_USERDATA explicitly to override (useful for testing).
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'NoteLiner');
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'NoteLiner');
    default: {
      const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      return path.join(xdg, 'NoteLiner');
    }
  }
}

function fail(msg, code = 1) {
  process.stderr.write(`noteliner-mcp-bridge: ${msg}\n`);
  process.exit(code);
}

const userData = process.env.NOTELINER_USERDATA || defaultUserData();
const runtimePath = path.join(userData, 'mcp-runtime.json');

if (!fs.existsSync(runtimePath)) {
  fail(`NoteLiner is not running, no project is open, or the MCP server is disabled (missing ${runtimePath}).`, 2);
}

let runtime;
try {
  runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
} catch (err) {
  fail(`failed to read runtime file: ${err.message}`);
}

if (!runtime?.socketPath) {
  fail('runtime file is missing socketPath');
}

const sock = net.connect(runtime.socketPath, () => {
  // Connected. Begin piping in both directions. Use { end: false } so a
  // half-close on one side does not propagate before any in-flight response
  // is drained.
  process.stdin.pipe(sock);
  sock.pipe(process.stdout);
});

sock.on('error', (err) => {
  fail(`connection error: ${err.message}`);
});

sock.on('close', () => {
  // NoteLiner stopped the server (project closed, app quit). Exit cleanly
  // so the MCP client surfaces a transport error rather than hanging.
  process.exit(0);
});

// Forward client-initiated termination to the socket.
process.stdin.on('end', () => {
  sock.end();
});

// Don't let an uncaught error crash us silently — the client only sees
// stderr if we print to it.
process.on('uncaughtException', (err) => {
  fail(`uncaught: ${err.message}`);
});
