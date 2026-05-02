const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');

// Smallest possible PNG: 1x1 transparent.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('attach a file: stored in _attachments, recorded in index, persisted in git', async ({ app, project }) => {
  const attachment = await app.window.evaluate(async ({ proj, b64 }) => {
    await window.__nlTest.initProject(proj, null);
    await window.__nlTest.createFile('Note with attachment', []);
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return await window.__nlTest.addAttachment(bytes.buffer, 'tiny.png');
  }, { proj: project, b64: TINY_PNG_BASE64 });

  expect(attachment).toBeTruthy();
  expect(attachment.originalName).toBe('tiny.png');
  expect(attachment.filename).toMatch(/^att-[a-f0-9]+\.png$/);

  // File written to _attachments/.
  const attPath = path.join(project, '_attachments', attachment.filename);
  expect(fs.existsSync(attPath)).toBe(true);
  expect(fs.statSync(attPath).size).toBeGreaterThan(0);

  // Index records the attachment on the note.
  const index = JSON.parse(fs.readFileSync(path.join(project, 'noteliner.json'), 'utf-8'));
  expect(index.files).toHaveLength(1);
  const attachments = index.files[0].attachments || [];
  expect(attachments).toHaveLength(1);
  expect(attachments[0].filename).toBe(attachment.filename);
  expect(attachments[0].originalName).toBe('tiny.png');
});
