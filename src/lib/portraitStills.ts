import { useEffect, useSyncExternalStore } from 'react'
import { mediaUrl } from '@/lib/media'

/**
 * Portrait covers for portrait footage, taken from the footage itself.
 *
 * Every poster in the archive is cut to 16:9, because that is the shape the
 * /work grid gives every frame — and half the archive is phone video at 9:16.
 * On the index wall those entries are hung at their own ratio, so a 16:9 poster
 * had to be cropped down to a sliver out of its middle to fill them. Somebody
 * upright in a portrait frame came out as a close-up of their elbow.
 *
 * `posterPortrait` on a performance is the real fix: a 9:16 still chosen by
 * hand. Until an entry has one, this takes a still from the entry's own hover
 * loop — which is already cut at the footage's ratio, already on the media
 * host, a few dozen kilobytes, and the very clip the tile plays when it comes
 * alive, so the cover and the film agree about what is in the frame.
 *
 * One at a time, after the page has loaded. The wall's posters come first, and
 * a still is a decoder opened and closed again: running seventeen of those at
 * once would be the same pile-up `MAX_PLAYING` exists to avoid.
 *
 * The media host answers GETs with `Access-Control-Allow-Origin: *` (see
 * infra/r2-cors.json), which is what lets a canvas read the frame back out. If
 * it ever stops doing so the still simply fails and the tile keeps the 16:9
 * poster — nothing breaks, it just looks the way it did before.
 */

/** Seconds into the loop the still is taken: past any fade at the cut. */
const STILL_AT = 0.6
/** Give up on one clip after this long, so one bad file cannot stall the rest. */
const TIMEOUT_MS = 12000

/** src → object URL of the still, or null once it has failed. */
const stills = new Map<string, string | null>()
const queue: string[] = []
const listeners = new Set<() => void>()
let running = false

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** One frame of `src`, as a jpeg object URL. */
function grab(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const url = mediaUrl(src)
    if (!url) return resolve(null)

    const video = document.createElement('video')
    let settled = false
    const finish = (result: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Let the decoder go now rather than whenever the element is collected.
      video.removeAttribute('src')
      video.load()
      resolve(result)
    }
    const timer = window.setTimeout(() => finish(null), TIMEOUT_MS)

    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = Math.min(STILL_AT, Math.max(0.05, duration / 2))
    }
    video.onseeked = () => {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) return finish(null)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return finish(null)
      try {
        ctx.drawImage(video, 0, 0, w, h)
        // Throws on a tainted canvas: the host did not send CORS headers.
        canvas.toBlob(
          (blob) => finish(blob ? URL.createObjectURL(blob) : null),
          'image/jpeg',
          0.88,
        )
      } catch {
        finish(null)
      }
    }
    video.onerror = () => finish(null)
    video.src = url
  })
}

async function drain() {
  if (running) return
  running = true
  while (queue.length) {
    const src = queue.shift()!
    if (stills.has(src)) continue
    stills.set(src, await grab(src))
    notify()
  }
  running = false
}

function request(src: string) {
  if (stills.has(src) || queue.includes(src)) return
  queue.push(src)
  if (document.readyState === 'complete') drain()
  else window.addEventListener('load', () => drain(), { once: true })
}

/**
 * The portrait still for a clip.
 *
 * `undefined` while it is being taken, `null` if it could not be, and a URL
 * once it has been. Pass no `src` to ask for nothing.
 */
export function usePortraitStill(src: string | undefined) {
  const still = useSyncExternalStore(
    subscribe,
    () => (src ? stills.get(src) : null),
    () => null,
  )
  useEffect(() => {
    if (src) request(src)
  }, [src])
  return still
}
