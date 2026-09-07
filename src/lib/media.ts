/**
 * Where media lives.
 *
 * Content stores media as root-relative keys ("/media/posters/x.jpg") — the
 * same string works as a path under public/ in dev and as an object key in
 * the R2 bucket in production. This module is the only place that decides
 * which of the two a given key resolves to.
 *
 * Set VITE_R2_PUBLIC_URL to the bucket's public hostname (custom domain, or
 * the r2.dev development URL) and every poster, portrait, gallery still,
 * video and audio file is served from R2 instead of the bundle. Leave it
 * blank and the site runs entirely off public/ exactly as before, so local
 * dev and offline builds never depend on the bucket existing.
 *
 * VITE_MEDIA_BASE_URL stays supported as an alias for any other CDN.
 */

const RAW_BASE =
  import.meta.env.VITE_R2_PUBLIC_URL ||
  import.meta.env.VITE_MEDIA_BASE_URL ||
  ''

/** Normalised origin for remote media, or '' when serving from public/. */
export const MEDIA_BASE = RAW_BASE.trim().replace(/\/+$/, '')

/** True when media is being served from R2 (or another configured CDN). */
export const isRemoteMedia = MEDIA_BASE !== ''

/** Already a URL we must not rewrite — absolute, protocol-relative or inline. */
function isAbsolute(path: string) {
  return /^(https?:)?\/\//.test(path) || path.startsWith('data:')
}

/**
 * The tree this module speaks for.
 *
 * Everything the bucket holds is stored under "/media/", and everything
 * stored under "/media/" is in the bucket — `scripts/upload-media.mjs` mirrors
 * exactly that directory, so the two are the same set by construction. A key
 * outside it therefore has no object to resolve to, and handing one to the
 * bucket only builds a URL that 404s.
 *
 * Which makes this the switch between the site's two origins rather than a
 * guard against a mistake. An asset under "/media/" is served from R2; an
 * asset anywhere else in public/ is served by whoever is serving the site, and
 * choosing between them is a matter of moving the file. The scans have always
 * worked this way — see the note on PortraitStage's PIECES — and the About
 * film joins them for the same reason: it is the first thing the page asks
 * for, and it should come off the connection that is already open.
 */
const BUCKET_TREE = '/media/'

/**
 * Resolve a stored media key to a URL.
 *
 * Absolute URLs pass through untouched, so a single one-off asset can be
 * pointed anywhere without reconfiguring the whole site.
 */
export function mediaUrl(path: string | undefined): string | undefined {
  if (!path) return undefined
  if (isAbsolute(path)) return path
  if (!isRemoteMedia) return path
  if (!path.startsWith(BUCKET_TREE)) return path
  return `${MEDIA_BASE}/${path.replace(/^\/+/, '')}`
}

/**
 * The object key an asset occupies in the bucket — i.e. what
 * scripts/upload-media.mjs uploads it as. Kept next to `mediaUrl` so the
 * two can never drift apart.
 */
export function mediaKey(path: string): string {
  return path.replace(/^\/+/, '')
}

/**
 * Opens the connection to the media origin as early as possible.
 *
 * When media comes from R2 the very first poster request otherwise pays for a
 * DNS lookup, a TCP handshake and a TLS negotiation before a single byte of
 * image arrives — all of it on the critical path to first paint, and all of it
 * avoidable by starting the handshake while the bundle is still parsing.
 *
 * A no-op when media is served from public/, where the connection is the one
 * that delivered the page.
 */
export function preconnectMedia() {
  if (!isRemoteMedia || typeof document === 'undefined') return
  let origin: string
  try {
    origin = new URL(MEDIA_BASE, window.location.href).origin
  } catch {
    return
  }
  if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return
  const link = document.createElement('link')
  link.rel = 'preconnect'
  // Deliberately no crossOrigin: posters load through plain <img> tags, which
  // use the credentialed socket. An anonymous preconnect would warm up the
  // other pool and the images would open a second connection anyway.
  link.href = origin
  document.head.appendChild(link)
}
