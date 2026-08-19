#!/usr/bin/env node
/**
 * Turns a folder of raw camera/phone footage into the three files the site
 * wants per entry: a web-safe mp4, a poster still, and a short silent loop
 * for the index wall.
 *
 *   public/media/video/<slug>.mp4        full recording   (detail page)
 *   public/media/preview/<slug>-480.mp4  ~8s, silent      (index wall)
 *   public/media/audio/<slug>.mp3        full soundtrack  (waveform player)
 *   public/media/posters/<slug>.jpg      still            (tile + fallback)
 *
 * Anything already web-safe is remuxed rather than re-encoded, so footage that
 * arrives as a modest H.264 file keeps its original quality and costs a
 * fraction of a second. Everything else is transcoded, because:
 *
 *   - HEVC (what modern iPhones record) decodes only where the OS provides it —
 *     Safari and Chrome on Apple silicon manage it, Firefox and most
 *     Windows/Linux machines show a black frame;
 *   - a rotation flag is honoured inconsistently, so rotated footage gets the
 *     rotation baked into the pixels instead;
 *   - 1080p+ at 9 Mb/s is far more than a tile or a detail page needs.
 *
 * Usage:
 *   node scripts/ingest-video.mjs <dir> --category <id> [options]
 *
 *   --category <id>   required; one of the CategoryId values, used for slugs
 *   --dry-run         list what would be written, touch nothing
 *   --start <n>       first index for the slug counter (default 1)
 *   --max-width <px>  long-side cap for transcodes (default 1280)
 *   --preview <s>     preview length in seconds (default 8)
 *
 * Slugs come out as `<category>-<year>-<nn>`, numbered by creation date, which
 * is the convention src/data/performances.ts already uses. Prints a JSON block
 * at the end with the slug, runtime and aspect of every file, ready to paste
 * into the content.
 *
 * Requires ffmpeg + ffprobe on PATH (`brew install ffmpeg`).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v', '.avi', '.mkv'])

/** Sources at or under these stay as-is; anything richer is re-encoded. */
const SAFE_CODEC = 'h264'
const SAFE_BITRATE = 3_000_000

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const positional = process.argv.slice(2).filter((a, i, all) => {
  if (a.startsWith('--')) return false
  return !all[i - 1]?.startsWith('--') || all[i - 1] === '--dry-run'
})

if (process.argv.includes('--help') || !positional[0]) {
  console.log(
    'Usage: node scripts/ingest-video.mjs <dir> --category <id> [--dry-run]\n' +
      '       [--start n] [--max-width px] [--preview seconds]',
  )
  process.exit(positional[0] ? 0 : 1)
}

const srcDir = positional[0].replace(/^~/, process.env.HOME ?? '~')
const category = arg('category')
const dryRun = process.argv.includes('--dry-run')
const start = Number(arg('start', '1'))
const maxWidth = Number(arg('max-width', '1280'))
const previewSecs = Number(arg('preview', '8'))

if (!category) {
  console.error('--category is required (e.g. --category solo-concert)')
  process.exit(1)
}
if (!existsSync(srcDir)) {
  console.error(`No such directory: ${srcDir}`)
  process.exit(1)
}
for (const bin of ['ffmpeg', 'ffprobe']) {
  if (spawnSync(bin, ['-version'], { stdio: 'ignore' }).status !== 0) {
    console.error(`${bin} not found on PATH — brew install ffmpeg`)
    process.exit(1)
  }
}

const OUT = {
  video: 'public/media/video',
  preview: 'public/media/preview',
  audio: 'public/media/audio',
  poster: 'public/media/posters',
}

/**
 * Suffix on preview filenames, naming the cut.
 *
 * The bucket serves an immutable one-year cache header, so re-cutting a
 * preview at a different size has to land under a *new* key — otherwise
 * browsers and Cloudflare's edge go on serving the old, heavier file. Bump
 * this whenever PREVIEW_WIDTH or PREVIEW_FPS changes.
 */
const PREVIEW_WIDTH = 480
const PREVIEW_FPS = 15
if (!dryRun) for (const d of Object.values(OUT)) mkdirSync(d, { recursive: true })

/** Video stream facts, with the rotation flag resolved into display dims. */
function probe(file) {
  const res = spawnSync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', file],
    { encoding: 'utf8', maxBuffer: 1 << 24 },
  )
  if (res.status !== 0) return null
  let json
  try {
    json = JSON.parse(res.stdout)
  } catch {
    return null
  }
  const v = json.streams?.find((s) => s.codec_type === 'video')
  if (!v) return null

  const rotation =
    v.side_data_list?.reduce((r, sd) => (sd.rotation != null ? Number(sd.rotation) : r), 0) ?? 0
  const turned = Math.abs(rotation) === 90 || Math.abs(rotation) === 270

  return {
    codec: v.codec_name,
    width: turned ? v.height : v.width,
    height: turned ? v.width : v.height,
    rotation,
    duration: Number(json.format?.duration ?? 0),
    bitRate: Number(json.format?.bit_rate ?? 0),
    created: v.tags?.creation_time ?? json.format?.tags?.creation_time ?? null,
  }
}

/**
 * Best guess at when a clip was actually shot.
 *
 * Footage that has been through Drive carries a container `creation_time` of
 * the *export*, not the recording, and it can be years late. Copying a file
 * only ever moves a timestamp forward, never back, so the earliest stamp
 * available is the closest thing to the truth. Where every stamp is an export
 * date this is still wrong — those entries are worth eyeballing.
 */
function shotAt(meta, file) {
  const stamps = [statSync(file).mtime.getTime()]
  if (meta.created) {
    const t = Date.parse(meta.created)
    if (Number.isFinite(t)) stamps.push(t)
  }
  return Math.min(...stamps)
}

function run(args) {
  return spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
}

/** Long side capped at `maxWidth`, short side even, aspect preserved. */
const scaleFilter = (cap) =>
  `scale='if(gt(iw,ih),min(${cap},iw),-2)':'if(gt(iw,ih),-2,min(${cap},ih))'`

const files = readdirSync(srcDir)
  .filter((f) => !f.startsWith('.') && VIDEO_EXT.has(path.extname(f).toLowerCase()))
  .map((f) => {
    const full = path.join(srcDir, f)
    const meta = probe(full)
    return { file: f, full, meta, shot: meta ? shotAt(meta, full) : 0 }
  })
  .filter((x) => {
    if (!x.meta) console.warn(`  skip  ${x.file}  (unreadable)`)
    return x.meta
  })
  .sort((a, b) => a.shot - b.shot || a.file.localeCompare(b.file))

if (!files.length) {
  console.error(`No video files under ${srcDir}`)
  process.exit(1)
}

console.log(
  `${dryRun ? 'Would ingest' : 'Ingesting'} ${files.length} file(s) from ${srcDir}\n`,
)

const results = []
let failed = 0

files.forEach((item, i) => {
  const { file, full, meta, shot } = item
  const year = new Date(shot).getFullYear()
  const slug = `${category}-${year}-${String(start + i).padStart(2, '0')}`
  const dst = path.join(OUT.video, `${slug}.mp4`)

  const longSide = Math.max(meta.width, meta.height)
  const remux =
    meta.codec === SAFE_CODEC &&
    meta.rotation === 0 &&
    longSide <= maxWidth &&
    meta.bitRate <= SAFE_BITRATE

  const why = remux
    ? 'remux'
    : meta.codec !== SAFE_CODEC
      ? `encode (${meta.codec})`
      : meta.rotation !== 0
        ? `encode (rot ${meta.rotation})`
        : longSide > maxWidth
          ? `encode (${longSide}px)`
          : `encode (${(meta.bitRate / 1e6).toFixed(1)}Mb/s)`

  console.log(
    `  ${String(i + 1).padStart(2)}/${files.length}  ${slug.padEnd(30)} ` +
      `${file.slice(0, 34).padEnd(34)} ${why}`,
  )
  if (dryRun) return

  const enc = remux
    ? ['-i', full, '-c', 'copy', '-map', '0:v:0', '-map', '0:a:0?', '-movflags', '+faststart', dst]
    : [
        '-i', full,
        '-vf', scaleFilter(maxWidth),
        '-c:v', 'libx264', '-profile:v', 'high', '-crf', '23', '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        '-movflags', '+faststart', '-max_muxing_queue_size', '1024',
        dst,
      ]

  const res = run(enc)
  if (res.status !== 0 || !existsSync(dst)) {
    console.error(`        FAILED  ${file}\n${res.stderr?.toString().trim()}`)
    failed++
    return
  }

  // Re-probe the output: the encode may have rotated and rescaled it, and the
  // content needs the *rendered* aspect, not the source's.
  const out = probe(dst)
  // A third of the way in is past the walk-on and before the applause.
  const seek = String(out.duration * 0.35)

  run(['-ss', seek, '-i', dst, '-frames:v', '1', '-q:v', '3', path.join(OUT.poster, `${slug}.jpg`)])

  // Every tile in frame plays its preview at once, so these are cut small and
  // slow on purpose: decode cost, not file size, is the limit here.
  run([
    '-ss', seek, '-t', String(previewSecs), '-i', dst, '-an',
    '-vf', `${scaleFilter(PREVIEW_WIDTH)},fps=${PREVIEW_FPS}`,
    '-c:v', 'libx264', '-crf', '32', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-profile:v', 'main', '-movflags', '+faststart',
    path.join(OUT.preview, `${slug}-${PREVIEW_WIDTH}.mp4`),
  ])

  // Soundtrack for the waveform player, taken from the original rather than
  // the transcode so remuxed sources avoid a second lossy generation.
  run([
    '-i', full, '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100',
    '-ac', '2', path.join(OUT.audio, `${slug}.mp3`),
  ])

  const mins = Math.floor(out.duration / 60)
  const secs = Math.round(out.duration % 60)
  results.push({
    source: file,
    slug,
    category,
    year,
    runtime: `${mins}:${String(secs).padStart(2, '0')}`,
    aspect: Number((out.width / out.height).toFixed(4)),
    portrait: out.height > out.width,
    mb: Number((statSync(dst).size / 1e6).toFixed(1)),
    previewSrc: `/media/preview/${slug}-${PREVIEW_WIDTH}.mp4`,
    audioSrc: `/media/audio/${slug}.mp3`,
  })
})

if (dryRun) {
  console.log('\n(dry run — nothing was written)')
  process.exit(0)
}

console.log(
  `\n${results.length}/${files.length} ingested` +
    (failed ? `, ${failed} failed` : '') +
    ` — ${results.reduce((a, r) => a + r.mb, 0).toFixed(0)} MB of video\n`,
)
console.log('Paste into src/data/performances.ts (titles and venue still to write):\n')
console.log(JSON.stringify(results, null, 2))
console.log('\nThen: npm run media:upload')

process.exit(failed ? 1 : 0)
