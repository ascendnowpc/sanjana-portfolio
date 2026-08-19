/**
 * Rasterises the generated SVG stage-stills to JPEG.
 *
 * This matters for more than file size: the index wall rescales every tile on
 * every frame, and an <img> pointing at an SVG is re-rasterised each time the
 * scale changes. Swapping to JPEG took the wall from ~13fps to ~30fps under
 * software rendering. Real photography has the same property, so this step
 * disappears once actual stills exist.
 *
 * Requires Playwright locally (it is NOT a project dependency):
 *   npm i -D playwright && node scripts/rasterize.mjs
 */
import { chromium } from 'playwright'
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'

const JOBS = [
  { dir: 'public/media/posters', width: 1200, height: 675 },
  { dir: 'public/media/portraits', width: 800, height: 1000 },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb'],
})

let count = 0
for (const { dir, width, height } of JOBS) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.svg'))
  const page = await browser.newPage({ viewport: { width, height } })

  for (const file of files) {
    const svg = await readFile(path.join(dir, file), 'utf8')
    await page.setContent(
      `<style>html,body{margin:0;background:#04070f;overflow:hidden}
       svg{display:block;width:${width}px;height:${height}px}</style>${svg}`,
    )
    const buf = await page.screenshot({ type: 'jpeg', quality: 78 })
    await writeFile(path.join(dir, file.replace(/\.svg$/, '.jpg')), buf)
    await unlink(path.join(dir, file))
    count++
  }
  await page.close()
}

await browser.close()
console.log(`rasterised ${count} frames`)
