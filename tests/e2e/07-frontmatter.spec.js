const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');

test('created note has YAML frontmatter on disk; readFile returns body only', async ({ app, project }) => {
  const { filename, fromIpc } = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const entry = await window.__nlTest.createFile('Frontmatter Test', ['alpha', 'beta']);
    await window.__nlTest.writeBody('# Frontmatter Test\n\nbody-line-one\n');
    const fromIpc = await window.api.readFile(entry.filename);
    return { filename: entry.filename, fromIpc };
  }, project);

  // The body returned by readFile must NOT include frontmatter.
  expect(fromIpc).not.toContain('---');
  expect(fromIpc).not.toContain('id:');
  expect(fromIpc).toContain('body-line-one');

  // The on-disk file MUST start with a YAML frontmatter block carrying the
  // mirrored fields.
  const raw = fs.readFileSync(path.join(project, filename), 'utf-8');
  expect(raw.startsWith('---\n')).toBe(true);
  expect(raw).toMatch(/^id:\s*[a-f0-9-]+/m);
  expect(raw).toMatch(/^name:\s*Frontmatter Test/m);
  expect(raw).toMatch(/alpha/);
  expect(raw).toMatch(/beta/);
  expect(raw).toContain('body-line-one');
});

test('renaming a note rewrites the on-disk frontmatter name field', async ({ app, project }) => {
  const newFilename = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const entry = await window.__nlTest.createFile('Original Name', []);
    await window.__nlTest.writeBody('# Original Name\n\nstable-body\n');
    const renamed = await window.__nlTest.renameFile(entry.id, 'Updated Name');
    return renamed.filename;
  }, project);

  const raw = fs.readFileSync(path.join(project, newFilename), 'utf-8');
  expect(raw).toMatch(/^name:\s*Updated Name/m);
  expect(raw).not.toMatch(/^name:\s*Original Name/m);
  expect(raw).toContain('stable-body');
});
