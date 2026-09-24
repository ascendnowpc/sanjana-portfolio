import type { FFmpeg } from '@ffmpeg/ffmpeg'

/**
 * Everything the site needs from a video, worked out in the browser.
 *
 * Dropping a recording on a video field is supposed to be the whole job: the
 * detail page wants the film, the waveform player wants its soundtrack, the
 * index wall wants a short silent loop, and every tile wants a still. That is
 * four files from one, and it is exactly what scripts/ingest-video.mjs has
 * always done at a terminal with ffmpeg on the PATH. This is the same work,
 * moved to where the person doing the editing actually is.
 *
 * It runs ffmpeg compiled to WebAssembly, in this tab. Which sounds extravagant
 * and is in fact the only honest place to put it: a serverless function takes a
 * few megabytes of request body and a recording is several hundred, so the
 * alternative is not "do it on the server", it is "upload it twice". Here the
 * bytes are already in the page, and the derived files are small enough to send.
 *
 * Three deliberate choices:
 *
 *   - **The single-threaded core.** The multi-threaded build needs
 *     SharedArrayBuffer, which needs COOP/COEP headers on every response, which
 *     would change how the whole site is served for the benefit of one admin
 *     screen. This is slower and costs the rest of the site nothing.
 *   - **The poster comes from the browser, not from ffmpeg.** A `<video>` and a
 *     canvas already have a hardware decoder behind them; asking the wasm build
 *     for one frame means decoding to that frame in software. ffmpeg is the
 *     fallback for footage the browser itself cannot open — HEVC on a machine
 *     with no system decoder, mostly.
 *   - **Nothing is mandatory.** Every derivation can fail — a codec the build
 *     cannot read, a file too big for a 32-bit heap — and each failure is
 *     reported as a note and skipped. A video that uploads with no extracted
 *     audio is a video with no audio track attached, not a failed upload.
 */

/** Pinned to the version @ffmpeg/ffmpeg 0.12 loads, and served from a CDN. */
const CORE_VERSION = '0.12.10'
const CORE_BASE =
  import.meta.env.VITE_FFMPEG_CORE_URL?.replace(/\/+$/, '') ||
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`

/** Roughly the size of the core the browser fetches the first time. */
export const FFMPEG_DOWNLOAD_MB = 31

/**
 * Above this, the wasm heap is the thing that will break, not the connection.
 *
 * The core addresses memory in 32 bits and the whole input has to be resident.
 * A file over this mark still *uploads* — it is only the derivations that are
 * skipped, with a note saying to run scripts/ingest-video.mjs for that one.
 */
const DERIVE_LIMIT_BYTES = 400 * 1024 * 1024

/** A third of the way in is past the walk-on and before the applause. */
const POSTER_AT = 0.35

/** As the ingest script cuts them: small, slow, silent. See its notes. */
const PREVIEW_SECONDS = 8
const PREVIEW_WIDTH = 480
const PREVIEW_FPS = 15

export type Stage = 'reading' | 'loading' | 'audio' | 'preview' | 'poster'

export interface VideoFacts {
  /** Seconds. 0 when the browser could not read the file. */
  duration: number
  /** width / height, as the site's `aspect` field wants it. */
  aspect: number
  width: number
  height: number
}

export interface Derived extends VideoFacts {
  /** An mp3 of the whole soundtrack. */
  audio?: Blob
  /** A short silent mp4 for the hover preview. */
  preview?: Blob
  /** A jpeg still. */
  poster?: Blob
  /** What could not be done, in words worth showing the editor. */
  notes: string[]
}

export interface DeriveOptions {
  audio?: boolean
  preview?: boolean
  poster?: boolean
  onStage?: (stage: Stage, fraction: number | null) => void
}

/* ============================= the browser ============================= */

/**
 * Duration and pixel dimensions, from the browser's own decoder.
 *
 * `videoWidth` is the *displayed* size, so footage shot on a phone with a
 * rotation flag reports portrait here — which is what the site's `aspect` field
 * has to hold, and what made the ingest script re-probe its own output.
 */
export function probeVideo(file: Blob): Promise<VideoFacts | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    const done = (facts: VideoFacts | null) => {
      URL.revokeObjectURL(url)
      resolve(facts)
    }
    video.onloadedmetadata = () => {
      const width = video.videoWidth
      const height = video.videoHeight
      done({
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width,
        height,
        aspect: width && height ? Number((width / height).toFixed(4)) : 16 / 9,
      })
    }
    video.onerror = () => done(null)
    video.src = url
  })
}

/**
 * One frame, as a jpeg, via a canvas.
 *
 * Seeking is the part that needs the event: setting `currentTime` is a request,
 * and drawing before it has been honoured paints the first frame — which on a
 * recording of a concert is very often an empty stage or a black fade.
 */
export function grabPoster(
  file: Blob,
  at = POSTER_AT,
): Promise<{ blob: Blob; facts: VideoFacts } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    // Same-origin blob, so the canvas it is drawn into stays untainted and
    // `toBlob` is allowed to read it back.
    video.crossOrigin = 'anonymous'

    const fail = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx || !canvas.width || !canvas.height) return fail()
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            resolve(
              blob
                ? {
                    blob,
                    facts: {
                      duration,
                      width: canvas.width,
                      height: canvas.height,
                      aspect: Number((canvas.width / canvas.height).toFixed(4)),
                    },
                  }
                : null,
            )
          },
          'image/jpeg',
          0.86,
        )
      }
      // A hair off the exact mark: seeking to precisely 0 on a file whose first
      // frame is not a keyframe can resolve without ever firing `seeked`.
      video.currentTime = Math.max(0.1, duration * at)
    }
    video.onerror = fail
    video.src = url
  })
}

/* ============================== the wasm ============================== */

let ffmpegPromise: Promise<FFmpeg> | null = null

/**
 * The core, loaded once per tab.
 *
 * Imported dynamically so the 100kB wrapper — and the 31MB of wasm behind it —
 * are fetched the first time somebody actually drops a video, and never by a
 * visitor reading the site.
 */
export function loadFfmpeg(
  onProgress?: (fraction: number | null) => void,
): Promise<FFmpeg> {
  ffmpegPromise ??= (async () => {
    const [{ FFmpeg: Core }, { toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ])
    const ffmpeg = new Core()
    onProgress?.(null)
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    return ffmpeg
  })()
  return ffmpegPromise
}

/** True once the core is in this tab, so the UI can stop warning about it. */
export function ffmpegReady(): boolean {
  return ffmpegPromise !== null
}

/** Run one ffmpeg command, reporting its progress, and read the result back. */
async function run(
  ffmpeg: FFmpeg,
  args: string[],
  outputName: string,
  type: string,
  onProgress?: (fraction: number | null) => void,
): Promise<Blob | null> {
  const listener = ({ progress }: { progress: number }) => {
    // ffmpeg's own progress overshoots and occasionally reports 0 at the end.
    onProgress?.(Math.min(1, Math.max(0, progress)))
  }
  ffmpeg.on('progress', listener)
  try {
    const code = await ffmpeg.exec(args)
    if (code !== 0) return null
    const data = await ffmpeg.readFile(outputName)
    if (typeof data === 'string') return null
    // A fresh view, so the Blob owns bytes the wasm heap is free to reuse.
    return new Blob([new Uint8Array(data)], { type })
  } catch {
    return null
  } finally {
    ffmpeg.off('progress', listener)
    await ffmpeg.deleteFile(outputName).catch(() => undefined)
  }
}

/** Long side capped, short side even, aspect kept — the ingest script's filter. */
const scaleFilter = (cap: number) =>
  `scale='if(gt(iw,ih),min(${cap},iw),-2)':'if(gt(iw,ih),-2,min(${cap},ih))'`

/* ============================== all of it ============================== */

/**
 * Everything at once, from one dropped file.
 *
 * Written as one pass over a single MEMFS copy of the input rather than three
 * calls that each write it again: the input is the biggest thing in memory by
 * an order of magnitude, and the heap here is not large.
 */
export async function deriveFromVideo(
  file: File | Blob,
  { audio = true, preview = false, poster = true, onStage }: DeriveOptions = {},
): Promise<Derived> {
  const notes: string[] = []
  const say = (stage: Stage, fraction: number | null) => onStage?.(stage, fraction)

  /* What the browser can tell us for free, and the still while we are there. */
  say('reading', null)
  let facts = await probeVideo(file)
  let posterBlob: Blob | undefined

  if (poster) {
    say('poster', null)
    const shot = await grabPoster(file)
    if (shot) {
      posterBlob = shot.blob
      facts ??= shot.facts
    }
  }

  const wanted = audio || preview || (poster && !posterBlob) || !facts
  if (!wanted) {
    return { ...(facts as VideoFacts), poster: posterBlob, notes }
  }

  if (file.size > DERIVE_LIMIT_BYTES) {
    notes.push(
      `This file is ${Math.round(file.size / 1e6)} MB, which is more than the in-browser ffmpeg can hold. It will upload as it is — run scripts/ingest-video.mjs for the audio and the preview loop.`,
    )
    return {
      ...(facts ?? { duration: 0, aspect: 16 / 9, width: 0, height: 0 }),
      poster: posterBlob,
      notes,
    }
  }

  say('loading', null)
  let ffmpeg: FFmpeg
  try {
    ffmpeg = await loadFfmpeg((f) => say('loading', f))
  } catch {
    notes.push(
      'Could not load the in-browser ffmpeg, so the audio and the preview loop were skipped. The video itself is fine.',
    )
    return {
      ...(facts ?? { duration: 0, aspect: 16 / 9, width: 0, height: 0 }),
      poster: posterBlob,
      notes,
    }
  }

  const input = 'derive-input'
  const { fetchFile } = await import('@ffmpeg/util')
  await ffmpeg.writeFile(input, await fetchFile(file))

  let audioBlob: Blob | undefined
  let previewBlob: Blob | undefined

  try {
    if (audio) {
      say('audio', 0)
      const out = await run(
        ffmpeg,
        ['-i', input, '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2', 'out.mp3'],
        'out.mp3',
        'audio/mpeg',
        (f) => say('audio', f),
      )
      if (out && out.size > 0) audioBlob = out
      else
        notes.push(
          'No audio could be extracted — the file may have no sound track, or one in a format this build cannot read.',
        )
    }

    if (preview) {
      say('preview', 0)
      const seek = String(Math.max(0, (facts?.duration ?? 0) * POSTER_AT))
      const out = await run(
        ffmpeg,
        [
          '-ss', seek,
          '-t', String(PREVIEW_SECONDS),
          '-i', input,
          '-an',
          '-vf', `${scaleFilter(PREVIEW_WIDTH)},fps=${PREVIEW_FPS}`,
          '-c:v', 'libx264',
          '-crf', '32',
          '-preset', 'veryfast',
          '-pix_fmt', 'yuv420p',
          '-profile:v', 'main',
          '-movflags', '+faststart',
          'out-preview.mp4',
        ],
        'out-preview.mp4',
        'video/mp4',
        (f) => say('preview', f),
      )
      if (out && out.size > 0) previewBlob = out
      else notes.push('The preview loop could not be cut; the full video will be used for hovers.')
    }

    // Only if the browser could not open the file at all: one frame decoded in
    // software is slow, and this is the case where there is no alternative.
    if (poster && !posterBlob) {
      say('poster', 0)
      const out = await run(
        ffmpeg,
        ['-ss', String(Math.max(0.1, (facts?.duration ?? 0) * POSTER_AT)), '-i', input, '-frames:v', '1', '-q:v', '3', 'out.jpg'],
        'out.jpg',
        'image/jpeg',
        (f) => say('poster', f),
      )
      if (out && out.size > 0) posterBlob = out
      else notes.push('No still could be taken from this file.')
    }
  } finally {
    await ffmpeg.deleteFile(input).catch(() => undefined)
  }

  if (!facts) {
    notes.push(
      'This browser cannot play this file, so its length and shape are unknown — and a visitor’s browser probably cannot play it either. Consider running scripts/ingest-video.mjs to convert it first.',
    )
  }

  return {
    ...(facts ?? { duration: 0, aspect: 16 / 9, width: 0, height: 0 }),
    audio: audioBlob,
    preview: previewBlob,
    poster: posterBlob,
    notes,
  }
}

/** `mm:ss`, for the runtime field. */
export function runtimeFrom(duration: number): string {
  const mins = Math.floor(duration / 60)
  const secs = Math.round(duration % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}
