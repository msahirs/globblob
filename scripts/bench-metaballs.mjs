import { chromium } from 'playwright'
import { createServer } from 'vite'

async function measureRafFrameTimes(page, { warmupFrames = 60, frames = 240 } = {}) {
  return page.evaluate(
    async ({ warmupFrames, frames }) => {
      await new Promise((resolve) => {
        let n = 0
        function step() {
          n++
          if (n >= warmupFrames) resolve()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      })

      const deltas = []
      let last = performance.now()

      await new Promise((resolve) => {
        function step(now) {
          deltas.push(now - last)
          last = now
          if (deltas.length >= frames) resolve()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      })

      deltas.sort((a, b) => a - b)
      const sum = deltas.reduce((a, b) => a + b, 0)
      const mean = sum / deltas.length
      const p50 = deltas[Math.floor(deltas.length * 0.5)] ?? mean
      const p95 = deltas[Math.floor(deltas.length * 0.95)] ?? mean
      const p99 = deltas[Math.floor(deltas.length * 0.99)] ?? mean

      return {
        frames,
        meanMs: mean,
        fpsApprox: 1000 / mean,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99,
        minMs: deltas[0] ?? mean,
        maxMs: deltas.at(-1) ?? mean,
      }
    },
    { warmupFrames, frames },
  )
}

async function main() {
  const server = await createServer({
    root: process.cwd(),
    logLevel: 'warn',
    server: { port: 5173, strictPort: false },
  })
  await server.listen()
  const baseUrl = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}`

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  try {
    await page.goto(`${baseUrl}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForSelector('.petriSimCanvas canvas')
    const result = await measureRafFrameTimes(page)
    // eslint-disable-next-line no-console
    console.log(`METABALLS_BENCH ${JSON.stringify(result)}`)
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
    await server.close().catch(() => {})
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})
