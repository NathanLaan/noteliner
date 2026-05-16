// MCP bridge integration test.
//
// Exercises the items 1–6 in the MCP plan's Testing section by driving the
// real `noteliner-mcp-bridge` binary as a child process — same wire path a
// real MCP client (Claude Code, Claude Desktop, Cursor) would use, just with
// a synthetic JSON-RPC driver in place of an LLM.
//
// Run: node tests/integration/mcp-bridge.test.js
//
// Requires: git installed on PATH. Does not require Electron or a GUI.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const { McpService } = require('../../src/main/mcp-service.js');
const { ProjectService } = require('../../src/main/project-service.js');
const { LinkGraphService } = require('../../src/main/link-graph-service.js');
const { GitService } = require('../../src/main/git-service.js');

const BRIDGE_PATH = path.join(__dirname, '..', '..', 'bin', 'noteliner-mcp-bridge.js');

let passed = 0, failed = 0;
const failures = [];

function section(label) { console.log(`\n=== ${label} ===`); }
function assert(name, ok, detail) {
  if (ok) { console.log(`  PASS  ${name}`); passed++; }
  else { console.log(`  FAIL  ${name}${detail ? '   ' + detail : ''}`); failed++; failures.push(name); }
}

// A minimal JSON-RPC 2.0 driver over a child process's stdio. Mirrors how a
// real MCP client interacts with the bridge.
class BridgeClient {
  constructor(child) {
    this.child = child;
    this.buf = '';
    this.handlers = new Map();
    this.nextId = 1;
    this.exited = false;
    child.stdout.on('data', (c) => this._onData(c));
    child.stderr.on('data', (c) => process.stderr.write('[bridge stderr] ' + c));
    child.on('exit', (code, signal) => { this.exited = { code, signal }; });
  }
  _onData(chunk) {
    this.buf += chunk.toString('utf-8');
    let idx;
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx); this.buf = this.buf.slice(idx + 1);
      if (!line.trim()) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      const handler = this.handlers.get(msg.id);
      if (handler) { this.handlers.delete(msg.id); handler.resolve(msg); }
    }
  }
  request(method, params, timeoutMs = 5000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.handlers.set(id, { resolve, reject });
      try { this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }
      catch (err) { this.handlers.delete(id); reject(err); return; }
      setTimeout(() => {
        if (this.handlers.has(id)) {
          this.handlers.delete(id);
          reject(new Error(`rpc timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }
  kill() {
    try { this.child.kill('SIGTERM'); } catch { /* ignore */ }
  }
}

async function setupGitProject(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `nl-int-${label}-`));
  execFileSync('git', ['init', '--quiet'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'IntegrationTest'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'integration@test.invalid'], { cwd: dir });
  // Disable GPG signing in case the user has commit.gpgsign=true globally —
  // we don't have a signing key in the test environment.
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
  return dir;
}

async function buildService(projectDir, userDataDir) {
  const gitService = new GitService(() => {}); // silent log
  const projectService = new ProjectService(gitService);
  const openResult = await projectService.openProject(projectDir);
  if (openResult.status !== 'loaded') throw new Error(`openProject status=${openResult.status}`);
  const linkGraphService = new LinkGraphService(projectService);
  await linkGraphService.rebuild();
  const mcpService = new McpService({
    projectService, linkGraphService, appVersion: 'integration', log: () => {},
    getPrefs: () => ({ confirmWrites: false, disabledTools: [] }),
  });
  const runtimePath = path.join(userDataDir, 'mcp-runtime.json');
  await mcpService.start(runtimePath);
  return { mcpService, projectService, linkGraphService, gitService, runtimePath };
}

function spawnBridge(userDataDir) {
  return spawn('node', [BRIDGE_PATH], {
    env: { ...process.env, NOTELINER_USERDATA: userDataDir },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function cleanup(...dirs) {
  for (const d of dirs) {
    if (d && fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('MCP bridge integration test — items 1–6 from the plan');

  // -------------------------------------------------------------------------
  section('Item 1: list_notes via the bridge returns the project notes');
  {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-int-ud-'));
    const projectDir = await setupGitProject('1');
    const { mcpService, projectService } = await buildService(projectDir, userDataDir);

    // Seed three notes directly through ProjectService — what a user would
    // have in their project when an MCP client connects.
    await projectService.createFile('Alpha', []);
    await projectService.createFile('Beta', ['tagged']);
    await projectService.createFile('Gamma', []);

    const bridge = spawnBridge(userDataDir);
    const client = new BridgeClient(bridge);

    const init = await client.request('initialize', {});
    assert('initialize via spawned bridge', init.result?.protocolVersion === '2024-11-05');

    const resp = await client.request('tools/call', { name: 'list_notes', arguments: {} });
    const notes = JSON.parse(resp.result.content[0].text);
    assert('list_notes returns 3 notes', notes.length === 3, `got ${notes.length}`);
    const names = notes.map(n => n.name).sort();
    assert('list_notes returns Alpha+Beta+Gamma',
      JSON.stringify(names) === JSON.stringify(['Alpha', 'Beta', 'Gamma']));

    client.kill();
    await mcpService.stop();
    cleanup(projectDir, userDataDir);
  }

  // -------------------------------------------------------------------------
  section('Item 2: create_note via the bridge -> on-disk file + real git commit');
  {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-int-ud-'));
    const projectDir = await setupGitProject('2');
    const { mcpService, projectService } = await buildService(projectDir, userDataDir);

    const bridge = spawnBridge(userDataDir);
    const client = new BridgeClient(bridge);
    await client.request('initialize', {});

    const t0 = Date.now();
    const resp = await client.request('tools/call', {
      name: 'create_note',
      arguments: { name: 'AI-Drafted Plan', body: '# AI plan\nfoo\n', tags: ['plan'] },
    });
    const elapsedMs = Date.now() - t0;
    assert('create_note succeeds', !resp.result.isError, resp.result.content?.[0]?.text);
    assert('create_note round-trip under 2s', elapsedMs < 2000, `${elapsedMs}ms`);

    // Find the created file via list_notes
    const list = await client.request('tools/call', { name: 'list_notes', arguments: {} });
    const notes = JSON.parse(list.result.content[0].text);
    const created = notes.find(n => n.name === 'AI-Drafted Plan');
    assert('new note is in the index', !!created);

    // On-disk verification — the .md file is what would surface in the FILES pane
    if (created) {
      const filePath = path.join(projectDir, created.filename);
      assert('markdown file exists on disk', fs.existsSync(filePath));
      const body = fs.readFileSync(filePath, 'utf-8');
      assert('on-disk body contains "AI plan"', body.includes('AI plan'));
      assert('on-disk frontmatter mirrors index name', body.includes('AI-Drafted Plan'));
      assert('on-disk frontmatter mirrors tag', body.includes('plan'));
    }

    // Real git commit verification — what the plan calls for
    const gitLog = execFileSync('git', ['log', '--oneline', '--pretty=format:%s'], { cwd: projectDir }).toString();
    assert('git log contains Add AI-Drafted Plan', /Add AI-Drafted Plan/.test(gitLog), gitLog.slice(0, 200));
    const fileInGit = execFileSync('git', ['ls-files'], { cwd: projectDir }).toString();
    assert('created file is tracked by git', created && fileInGit.includes(created.filename),
      fileInGit.slice(0, 200));

    client.kill();
    await mcpService.stop();
    cleanup(projectDir, userDataDir);
  }

  // -------------------------------------------------------------------------
  section('Item 3: MCP search returns the same hits as in-app search');
  {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-int-ud-'));
    const projectDir = await setupGitProject('3');
    const { mcpService, projectService } = await buildService(projectDir, userDataDir);

    await projectService.createFile('Recipe', [], { body: 'red apples and green apples\n' });
    await projectService.createFile('Shopping', [], { body: 'eggs, milk, apples\n' });
    await projectService.createFile('Notes', [], { body: 'no fruit here\n' });

    const bridge = spawnBridge(userDataDir);
    const client = new BridgeClient(bridge);
    await client.request('initialize', {});

    const inApp = projectService.search('apples', {});
    const resp = await client.request('tools/call', { name: 'search', arguments: { query: 'apples' } });
    const mcpHits = JSON.parse(resp.result.content[0].text);

    assert('hit count identical', inApp.length === mcpHits.length, `inApp=${inApp.length} mcp=${mcpHits.length}`);

    // fileIds are the stable identity — sort and compare so order doesn't matter
    const inAppIds = inApp.map(h => h.fileId).sort();
    const mcpIds = mcpHits.map(h => h.fileId).sort();
    assert('hit fileIds identical', JSON.stringify(inAppIds) === JSON.stringify(mcpIds));

    // Match-count per file identical
    const inAppMatches = inApp.map(h => h.matches.length).reduce((a, b) => a + b, 0);
    const mcpMatches = mcpHits.map(h => h.matches.length).reduce((a, b) => a + b, 0);
    assert('total match count identical', inAppMatches === mcpMatches,
      `inApp=${inAppMatches} mcp=${mcpMatches}`);

    client.kill();
    await mcpService.stop();
    cleanup(projectDir, userDataDir);
  }

  // -------------------------------------------------------------------------
  section('Item 4: stop NoteLiner mid-call -> bridge exits, no hang');
  {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-int-ud-'));
    const projectDir = await setupGitProject('4');
    const { mcpService, projectService } = await buildService(projectDir, userDataDir);
    await projectService.createFile('Note', []);

    const bridge = spawnBridge(userDataDir);
    const client = new BridgeClient(bridge);
    await client.request('initialize', {});

    // Issue a request and stop the service before it can respond. The bridge
    // should observe the socket close and exit; the in-flight request gets
    // no response (timeout/reject), which is the correct transport-error
    // outcome for the real client.
    const callPromise = client.request('tools/call', { name: 'list_notes', arguments: {} }, 2500)
      .then(r => ({ result: r })).catch(e => ({ error: e }));
    setTimeout(() => mcpService.stop(), 30);

    const outcome = await callPromise;
    // Wait for the bridge exit signal to land
    await sleep(400);

    assert('bridge process exited', client.exited !== false, JSON.stringify(client.exited));
    // The bridge exits 0 on a clean socket close (see noteliner-mcp-bridge.js)
    assert('bridge exit code is clean (0 or null on SIGTERM)',
      client.exited && (client.exited.code === 0 || client.exited.code === null),
      JSON.stringify(client.exited));
    assert('in-flight request did not hang past timeout', !!outcome,
      'callPromise never settled');

    cleanup(projectDir, userDataDir);
  }

  // -------------------------------------------------------------------------
  section('Item 5: project switch -> tool results reflect the new project');
  {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-int-ud-'));
    const projectA = await setupGitProject('5a');
    const projectB = await setupGitProject('5b');

    // --- Project A
    const { mcpService: svcA, projectService: psA } = await buildService(projectA, userDataDir);
    await psA.createFile('Only-In-A', []);

    const bridgeA = spawnBridge(userDataDir);
    const clientA = new BridgeClient(bridgeA);
    await clientA.request('initialize', {});
    const respA = await clientA.request('tools/call', { name: 'list_notes', arguments: {} });
    const notesA = JSON.parse(respA.result.content[0].text);
    assert('project A: one note named Only-In-A',
      notesA.length === 1 && notesA[0].name === 'Only-In-A',
      JSON.stringify(notesA.map(n => n.name)));

    clientA.kill();
    await svcA.stop();
    await sleep(100);

    // --- Project B
    const { mcpService: svcB, projectService: psB } = await buildService(projectB, userDataDir);
    await psB.createFile('Only-In-B', []);

    const bridgeB = spawnBridge(userDataDir);
    const clientB = new BridgeClient(bridgeB);
    await clientB.request('initialize', {});
    const respB = await clientB.request('tools/call', { name: 'list_notes', arguments: {} });
    const notesB = JSON.parse(respB.result.content[0].text);
    assert('project B: one note named Only-In-B',
      notesB.length === 1 && notesB[0].name === 'Only-In-B',
      JSON.stringify(notesB.map(n => n.name)));
    assert('project B does not leak A\'s notes',
      !notesB.some(n => n.name === 'Only-In-A'));

    clientB.kill();
    await svcB.stop();
    cleanup(projectA, projectB, userDataDir);
  }

  // -------------------------------------------------------------------------
  section('Item 6: stale socket from a SIGKILLed instance does not block startup');
  if (process.platform === 'win32') {
    assert('skipped (Windows named pipes auto-clean)', true);
  } else {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-int-ud-'));
    const projectDir = await setupGitProject('6');

    // The service computes its socket path from process.pid, so we know
    // exactly where it will try to listen. Plant a stub file there to
    // simulate a previous instance that died ungracefully.
    const expectedSocketPath = path.join(os.tmpdir(), `noteliner-mcp-${process.pid}.sock`);
    if (fs.existsSync(expectedSocketPath)) fs.unlinkSync(expectedSocketPath);
    fs.writeFileSync(expectedSocketPath, 'stale stub from SIGKILLed instance');
    assert('stale stub file exists pre-start', fs.existsSync(expectedSocketPath));

    let startError = null;
    let svc;
    try {
      const built = await buildService(projectDir, userDataDir);
      svc = built.mcpService;
    } catch (err) {
      startError = err;
    }
    assert('service started despite stale socket', !startError && svc?.isRunning(),
      startError ? startError.message : 'service not running');

    // The on-disk file should now be a real socket — connect through the
    // bridge to prove it actually accepts connections post-cleanup.
    if (svc?.isRunning()) {
      const bridge = spawnBridge(userDataDir);
      const client = new BridgeClient(bridge);
      const init = await client.request('initialize', {});
      assert('bridge can connect after stale-socket cleanup',
        init.result?.protocolVersion === '2024-11-05');
      client.kill();
      await svc.stop();
    }
    cleanup(projectDir, userDataDir);
  }

  // -------------------------------------------------------------------------
  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    console.log('FAILED:');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('UNCAUGHT', err); process.exit(2); });
