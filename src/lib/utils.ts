/** Tiny classnames joiner — avoids pulling in clsx for the handful of uses. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Hermite smoothstep, used to fade tiles in/out at the ends of the tunnel. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Deterministic PRNG so generated layouts/waveforms are stable across renders. */
export function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function hashString(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 254 -> "4:14" */
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Total runtime of a track list, as "23 min". */
export function totalRuntime(durations: number[]) {
  const total = durations.reduce((a, b) => a + b, 0)
  return `${Math.round(total / 60)} min`
}

/**
 * Media paths are stored relative ("/media/..."). When VITE_MEDIA_BASE_URL is
 * set, relative paths are rehomed onto that CDN; absolute URLs pass through.
 */
export function mediaUrl(path: string | undefined): string | undefined {
  if (!path) return undefined
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path
  const base = import.meta.env.VITE_MEDIA_BASE_URL
  if (!base) return path
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
