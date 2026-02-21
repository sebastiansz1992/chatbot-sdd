import { expect, test } from '@playwright/test'

test('measure FCP and interaction latency', async ({ page }) => {
  await page.goto('/')

  const fcp = await page.evaluate(() => {
    const entry = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry | undefined
    return entry ? entry.startTime : 0
  })

  const value = 'Perf interaction message'
  await page.getByRole('textbox', { name: /entrada de chat/i }).fill(value)

  const interaction = await page.evaluate(async (messageValue) => {
    const button = document.querySelector('button[aria-label="Enviar mensaje"]') as HTMLButtonElement

    const start = performance.now()

    await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (document.body.textContent?.includes(messageValue)) {
          observer.disconnect()
          resolve()
        }
      })
      observer.observe(document.body, { subtree: true, childList: true })
      button.click()
    })

    return performance.now() - start
  }, value)

  console.log(`FCP_MS=${fcp.toFixed(2)}`)
  console.log(`INTERACTION_MS=${interaction.toFixed(2)}`)

  if (fcp > 0) {
    expect(fcp).toBeLessThan(2000)
  }
  expect(interaction).toBeLessThan(100)
})
