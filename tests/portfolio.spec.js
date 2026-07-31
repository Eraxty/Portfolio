import { expect, test } from '@playwright/test';

test('portfolio renders core experience without overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toContainText('HARDIK');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-portal="orange"]')).toBeVisible();
  await expect(page.locator('[data-portal="blue"]')).toBeVisible();

  await page.locator('a[href="#work"]').first().click();
  await expect(page.locator('#work')).toBeInViewport();
  await page.locator('article.project-specimen button').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);

  await page.locator('a[href="#contact"]').first().click();
  await expect(page.locator('#contact')).toBeInViewport();
  await expect(page.locator('a[href="mailto:hardikrajotiyamars@gmail.com"]')).toBeVisible();

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
  expect(errors).toEqual([]);
});
