import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('loads the biolab onepager UI', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByAltText('Logo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByText('Draaisnelheid')).toBeVisible()
  await expect(page.getByText('pH niveau')).toBeVisible()
  await expect(page.getByText('Zuurstof niveau')).toBeVisible()
  await expect(page.getByLabel('Petri dish simulation')).toBeVisible()

  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
})

test('loads the microbiology config UI', async ({ page }) => {
  await page.goto('/microbiology/config')
  await expect(page.getByRole('heading', { name: 'Configuration library' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Population curve builder' })).toBeVisible()
  await expect(page.getByLabel('Expression')).toBeVisible()

  await page.getByLabel('Expression').fill('sin(')
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})
