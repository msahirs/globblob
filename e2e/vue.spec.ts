import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Simulations')
  await expect(page.getByRole('link', { name: 'Physarum' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Metaballs' })).toBeVisible()
})

test('loads the physarum dev page', async ({ page }) => {
  await page.goto('/physarum')
  await expect(page.locator('.phys-root')).toBeVisible()
})

test('loads the metaballs dev page', async ({ page }) => {
  await page.goto('/metaballs')
  await expect(page.locator('.mb-root')).toBeVisible()
})
