const { test, expect } = require('./fixtures');

test('app boots and shows the open screen', async ({ app }) => {
  await expect(app.window.locator('.app-title')).toHaveText('NoteLiner');
  await expect(app.window.locator('button', { hasText: 'New Project' })).toBeVisible();
  await expect(app.window.locator('button', { hasText: 'Open Project' })).toBeVisible();
});
