#!/usr/bin/env node
/**
 * Uploads everything under public/media/ to the Cloudflare R2 bucket, keeping
 * the paths identical: public/media/posters/x.jpg becomes the object
 * media/posters/x.jpg, which is exactly the key src/lib/media.ts appends to
 * VITE_R2_PUBLIC_URL. Add a file locally, run this, and it is live — no
 * content edits required.
 *
 * Usage:
 *   npm run media:upload                 # bucket from R2_BUCKET or the default
 *   npm run media:upload -- --dry-run    # list what would be sent
 *   npm run media:upload -- --bucket my-bucket --dir public/media
 *
 * Auth is wrangler's: run `npx wrangler login` once, or export
 * CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in CI.
 */
import { spawnSync } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_BUCKET = 'sanjana-portfolio-media'

/** Long cache: media is replaced by uploading a new filename, not in place. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const bucket = arg('bucket', process.env.R2_BUCKET || DEFAULT_BUCKET)
const dir = arg('dir', 'public/media')
const dryRun = process.argv.includes('--dry-run')

/** Every file under `root`, depth-first, as paths relative to public/. */
async function walk(root) {
  const out = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (entry.isFile() && !entry.name.startsWith('.')) out.push(full)
  }
  return out
}

const files = (await walk(dir)).sort()
if (!files.length) {
  console.error(`No files under ${dir}/`)
  process.exit(1)
}

console.log(
  `${dryRun ? 'Would upload' : 'Uploading'} ${files.length} file(s) to r2://${bucket}\n`,
)

let failed = 0
for (const file of files) {
  // Keys mirror the URL path the site requests: public/media/... -> media/...
  const key = path.relative('public', file).split(path.sep).join('/')
  const ext = path.extname(file).toLowerCase()
  const type = CONTENT_TYPES[ext]

  if (!type) {
    console.warn(`  skip  ${key}  (unknown extension ${ext})`)
    continue
  }

  const size = (await stat(file)).size
  const kb = `${Math.round(size / 1024)}kB`.padStart(8)
  console.log(`  ${dryRun ? 'plan' : 'put '}  ${key}${kb}`)
  if (dryRun) continue

  const res = spawnSync(
    'npx',
    [
      'wrangler',
      'r2',
      'object',
      'put',
      `${bucket}/${key}`,
      '--file',
      file,
      '--content-type',
      type,
      '--cache-control',
      CACHE_CONTROL,
      '--remote',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )

  if (res.status !== 0) {
    console.error(`  FAIL  ${key}`)
    failed++
  }
}

if (failed) {
  console.error(`\n${failed} upload(s) failed.`)
  process.exit(1)
}
console.log(`\nDone.${dryRun ? ' (dry run — nothing was sent)' : ''}`)
