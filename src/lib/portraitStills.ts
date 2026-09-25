import { useEffect, useSyncExternalStore } from 'react'
import { mediaUrl } from '@/lib/media'

/**
 * Portrait covers for portrait footage, taken from the footage itself.
 *
 * Every poster in the archive is cut to 16:9, because that is the shape the
 * /work grid gives every frame — and half the archive is phone video at 9:16.
 * On the index wall those entries are hung at their own ratio, so a 16:9 poster
 * had to be cropped down to a sliver out of its middle to fill them.
 *
 * `posterPortrait` on a performance is the real fix: a 9:16 still chosen by
 * hand. Until an entry has one, this takes a still from the entry's own hover
 * loop — already cut at the footage's ratio, a few dozen kilobytes, and the
 * very clip the tile plays when it comes alive.
 *
 * Nothing waits on this. The tile shows its 16:9 poster from the first paint
 * and the portrait still fades in over it when it is ready, so a slow or
 * failed grab costs a nicer cover and never an empty frame. That was the
 * mistake of the first version: tiles were held blank until their still
 * arrived, a blank tile's video had no poster, and Safari will not autoplay a
 * video it considers invisible — so some frames never played at all.
 *
 * Kept fast on purpose:
 *  - a few clips at a time, not one, with a short timeout, so one stuck file
 *    cannot hold the queue;
 *  - `play()` rather than `preload` to get the file loading — Safari, and iOS
 *    in particular, ignore `preload` on an element nobody has asked to play,
 *    and a muted inline video is allowed to play without a gesture;
 *  - the finished stills are kept in Cache Storage, so a second visit shows
 *    them from the first frame without touching a video at all;
 *  - the clip is requested under its own URL (`?still`), so this CORS request
 *    and the tile's own plain request never share a cache entry. A response
 *    cached for one is not always acceptable to the other, and a mismatch
 *    there is exactly the kind of thing that leaves a video refusing to load.
 *
 * The media host answers GETs with `Access-Control-Allow-Origin: *` (see
 * infra/r2-cors.json), which is what lets a canvas read the frame back. If it
 * ever stops, every grab fails quietly and the tiles keep their 16:9 posters.
 */

/** Seconds into the loop the still is taken: past any fade at the cut. */
const STILL_AT = 0.6
/** Give up on one clip after this long. */
const TIMEOUT_MS = 5000
/** Clips worked on at once. */
const CONCURRENCY = 3
/** Cache Storage bucket; bump the suffix to throw every stored still away. */
const CACHE_NAME = 'portrait-stills-v1'

/** src → object URL of the still, or null once it has failed. */
const stills = new Map<string, string | null>()
const queue: string[] = []
/** Asked for already — queued, in progress or done. */
const requested = new Set<string>()
const listeners = new Set<() => void>()
let active = 0

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The key a still is stored under — a same-origin URL, as Cache wants. */
const cacheKey = (src: string) =>
  `${location.origin}/__portrait-still/${encodeURIComponent(src)}`

async function fromCache(src: string): Promise<string | null> {
  try {
    if (!('caches' in window)) return null
    const hit = await (await caches.open(CACHE_NAME)).match(cacheKey(src))
    return hit ? URL.createObjectURL(await hit.blob()) : null
  } catch {
    return null
  }
}

async function toCache(src: string, blob: Blob) {
  try {
    if (!('caches' in window)) return
    await (await caches.open(CACHE_NAME)).put(
      cacheKey(src),
      new Response(blob, { headers: { 'Content-Type': 'image/jpeg' } }),
    )
  } catch {
    /* private mode, quota — the still is simply taken again next visit */
  }
}

/** One frame of `src`, as a jpeg. */
function grab(src: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const base = mediaUrl(src)
    if (!base) return resolve(null)
    const url = `${base}${base.includes('?') ? '&' : '?'}still`

    const video = document.createElement('video')
    let settled = false
    let seeking = false
    const finish = (result: Blob | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.pause()
      // Let the decoder go now rather than whenever the element is collected.
      video.removeAttribute('src')
      video.load()
      resolve(result)
    }
    const timer = window.setTimeout(() => finish(null), TIMEOUT_MS)

    const seek = () => {
      if (seeking || settled) return
      seeking = true
      video.pause()
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = Math.min(STILL_AT, Math.max(0.05, duration / 2))
    }

    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onloadeddata = seek
    video.onplaying = seek
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
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.88)
      } catch {
        finish(null)
      }
    }
    video.onerror = () => finish(null)
    video.src = url
    video.play().catch(() => {
      /* refused: `loadeddata` still arrives wherever preload is honoured */
    })
  })
}

async function work(src: string) {
  let still = await fromCache(src)
  if (!still) {
    const blob = await grab(src)
    if (blob) {
      still = URL.createObjectURL(blob)
      void toCache(src, blob)
    }
  }
  stills.set(src, still)
  notify()
}

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const src = queue.shift()!
    active++
    work(src).finally(() => {
      active--
      pump()
    })
  }
}

function request(src: string) {
  if (requested.has(src)) return
  requested.add(src)
  queue.push(src)
  pump()
}

/**
 * The portrait still for a clip: a URL once it has been taken, otherwise
 * null. Pass no `src` to ask for nothing.
 */
export function usePortraitStill(src: string | undefined) {
  const still = useSyncExternalStore(
    subscribe,
    () => (src ? (stills.get(src) ?? null) : null),
    () => null,
  )
  useEffect(() => {
    if (src) request(src)
  }, [src])
  return still
}
