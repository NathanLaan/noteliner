const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('./fixtures');

test('rename note updates filename, preserves content, and commits', async ({ app, project }) => {
  const { oldFilename, newFilename } = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const entry = await window.__nlTest.createFile('Original', []);
    await window.__nlTest.writeBody('# Original\n\nbody-text\n');
    const oldFilename = entry.filename;
    const renamed = await window.__nlTest.renameFile(entry.id, 'Renamed');
    return { oldFilename, newFilename: renamed.filename };
  }, project);

  expect(oldFilename).not.toBe(newFilename);

  // Old file gone, new file present, content preserved.
  expect(fs.existsSync(path.join(project, oldFilename))).toBe(false);
  expect(fs.existsSync(path.join(project, newFilename))).toBe(true);
  const body = fs.readFileSync(path.join(project, newFilename), 'utf-8');
  expect(body).toContain('body-text');

  // Index reflects new name.
  const index = JSON.parse(fs.readFileSync(path.join(project, 'noteliner.json'), 'utf-8'));
  expect(index.files).toHaveLength(1);
  expect(index.files[0].name).toBe('Renamed');
  expect(index.files[0].filename).toBe(newFilename);

  // Rename produced a commit referencing both filenames.
  const log = execFileSync('git', ['log', '--oneline'], { cwd: project, env: process.env }).toString();
  expect(log).toMatch(/Rename/i);
});
