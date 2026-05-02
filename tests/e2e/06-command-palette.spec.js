const { test, expect } = require('./fixtures');

test('command palette opens with Ctrl+K, filters, and closes on Escape', async ({ app }) => {
  // Open
  await app.window.keyboard.press('Control+K');
  await expect(app.window.locator('.palette')).toBeVisible();

  // Filter to a command that exists with no project open ("About").
  const input = app.window.locator('.palette input');
  await input.fill('about');
  await expect(app.window.locator('.palette-row').first()).toContainText('About');

  // Close
  await app.window.keyboard.press('Escape');
  await expect(app.window.locator('.palette')).toBeHidden();
});

test('command palette dispatches a command via Enter', async ({ app }) => {
  // Default state: About modal not present.
  await expect(app.window.locator('.modal-overlay')).toHaveCount(0);

  await app.window.keyboard.press('Control+K');
  await app.window.locator('.palette input').fill('about');

  const firstRow = app.window.locator('.palette-row').first();
  await expect(firstRow).toContainText('About');

  await app.window.keyboard.press('Enter');
  await expect(app.window.locator('.palette')).toBeHidden();

  // About modal is shown after dispatch.
  await expect(app.window.locator('.modal-overlay')).toHaveCount(1);
});
