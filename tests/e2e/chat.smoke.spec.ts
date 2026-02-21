import { expect, test } from '@playwright/test'

test('smoke: send message and see timeline append', async ({ page }) => {
  await page.goto('/')

  const input = page.getByRole('textbox', { name: /entrada de chat/i })
  await input.fill('Check my portfolio exposure')
  await page.getByRole('button', { name: /enviar mensaje/i }).click()

  await expect(page.getByText('Check my portfolio exposure')).toBeVisible()
})
