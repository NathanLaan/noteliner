const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('./fixtures');

test('delete note removes file from disk, index, and creates a delete commit', async ({ app, project }) => {
  const { keepFilename, killFilename } = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const keep = await window.__nlTest.createFile('Keeper', []);
    const kill = await window.__nlTest.createFile('Doomed', []);
    await window.__nlTest.deleteFile(kill.id);
    return { keepFilename: keep.filename, killFilename: kill.filename };
  }, project);

  // Disk: keeper present, doomed gone.
  expect(fs.existsSync(path.join(project, keepFilename))).toBe(true);
  expect(fs.existsSync(path.join(project, killFilename))).toBe(false);

  // Index: only keeper remains.
  const index = JSON.parse(fs.readFileSync(path.join(project, 'noteliner.json'), 'utf-8'));
  expect(index.files).toHaveLength(1);
  expect(index.files[0].name).toBe('Keeper');

  // A delete commit exists.
  const log = execFileSync('git', ['log', '--oneline'], { cwd: project, env: process.env }).toString();
  expect(log).toMatch(/Delete/i);
});
