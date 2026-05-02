const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('./fixtures');

test('create note, write body, and persist across restart', async ({ app, project, userData }) => {
  // Init project + create + write body via the IPC path (the same one the UI uses).
  const filename = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const entry = await window.__nlTest.createFile('Hello', []);
    await window.__nlTest.writeBody('# Hello\n\nworld\n');
    return entry.filename;
  }, project);

  // Sanity: index reflects the new file in-memory.
  const inMem = await app.window.evaluate(() => window.__nlTest.snapshot());
  expect(inMem.files).toHaveLength(1);
  expect(inMem.files[0].name).toBe('Hello');
  expect(inMem.editorContent).toContain('world');

  // Verify on-disk state. Writes are flushed once the IPC promise resolves —
  // ProjectService awaits the git commit before returning.
  const indexPath = path.join(project, 'noteliner.json');
  expect(fs.existsSync(indexPath)).toBe(true);
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  expect(index.files).toHaveLength(1);
  expect(index.files[0].name).toBe('Hello');
  expect(index.files[0].filename).toBe(filename);

  const body = fs.readFileSync(path.join(project, filename), 'utf-8');
  expect(body).toContain('world');

  // At least: init commit, add commit, body update commit.
  const log = execFileSync('git', ['log', '--oneline'], { cwd: project, env: process.env }).toString();
  const commits = log.split('\n').filter(Boolean);
  expect(commits.length).toBeGreaterThanOrEqual(2);
});
