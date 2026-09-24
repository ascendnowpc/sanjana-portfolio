/**
 * Putting a file into the bucket, from the page.
 *
 * Two steps, and the second one does not touch this site at all: ask
 * api/upload.ts to sign a PUT for one key, then send the bytes straight to R2.
 * A recording is hundreds of megabytes and a serverless request body is a few,
 * so there is no version of this that proxies the file.
 *
 * Progress comes from XMLHttpRequest rather than fetch, which still cannot
 * report how much of a request body it has sent. Uploading a concert over a
 * domestic connection is a minutes-long wait, and a minutes-long wait with no
 * bar is indistinguishable from a hang.
 */

/** Where each kind of file belongs, following the keys already in the data. */
export const MEDIA_FOLDERS = {
  video: 'media/video',
  preview: 'media/preview',
  audio: 'media/audio',
  poster: 'media/posters',
  cover: 'media/covers',
  portrait: 'media/portraits',
  image: 'media/posters',
} as const

export type MediaKind = keyof typeof MEDIA_FOLDERS

export interface UploadStatus {
  configured: boolean
  missing: string[]
  bucket: string | null
  unavailable?: string
}

const ENDPOINT = '/api/upload'

let statusPromise: Promise<UploadStatus> | null = null

/** Whether this deployment can accept uploads. Asked once, then remembered. */
export function uploadStatus(): Promise<UploadStatus> {
  statusPromise ??= (async () => {
    try {
      const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } })
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) {
        return {
          configured: false,
          missing: [],
          bucket: null,
          unavailable:
            'This deployment has no upload endpoint. Media can still be pointed at a URL by hand.',
        }
      }
      return (await res.json()) as UploadStatus
    } catch {
      return {
        configured: false,
        missing: [],
        bucket: null,
        unavailable: 'Could not reach the upload endpoint.',
      }
    }
  })()
  return statusPromise
}

/** Strip a filename down to something safe to put in a URL. */
export function slugifyFilename(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'file'
  )
}

/**
 * A key nothing else has used.
 *
 * The stamp is not decoration. R2 serves media with a one-year immutable cache
 * header, so replacing a file *at the same key* changes nothing a browser or
 * Cloudflare's edge will ever look at again — the existing ingest script and
 * the notes in data/music.ts both say so, having been caught by it. Every
 * upload therefore lands at a new key, and replacing a video means pointing the
 * content at the new one, which is exactly what the editor does.
 */
export function uniqueMediaKey(
  kind: MediaKind,
  filename: string,
  extension?: string,
): string {
  const ext = (extension ?? filename.split('.').pop() ?? 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const stamp = Date.now().toString(36).slice(-6)
  return `${MEDIA_FOLDERS[kind]}/${slugifyFilename(filename)}-${stamp}.${ext}`
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
}

/** The type to store the object as. A blob's own type wins when it has one. */
export function contentTypeFor(key: string, fallback?: string): string {
  if (fallback) return fallback
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export interface UploadHandle {
  /** 0–1, or null while the browser has not told us the total yet. */
  onProgress?: (fraction: number | null) => void
  /** Aborts the PUT. */
  signal?: AbortSignal
}

/**
 * Upload one file and return the key the site should store.
 *
 * The returned value is a *media key* with a leading slash — "/media/video/x.mp4"
 * — because that is what the content model holds and what `mediaUrl` resolves
 * (see lib/media.ts). The bucket's own object key has no leading slash; the two
 * differ by that one character and nothing else.
 */
export async function uploadMedia(
  file: Blob,
  {
    kind,
    filename,
    password,
    extension,
    onProgress,
    signal,
  }: {
    kind: MediaKind
    filename: string
    password: string
    extension?: string
    onProgress?: UploadHandle['onProgress']
    signal?: AbortSignal
  },
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const key = uniqueMediaKey(kind, filename, extension)
  const contentType = contentTypeFor(key, file.type || undefined)

  let signed: {
    ok?: boolean
    url?: string
    headers?: Record<string, string>
    error?: string
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password, key, contentType }),
      signal,
    })
    if (!res.headers.get('content-type')?.includes('json')) {
      return {
        ok: false,
        error:
          'This deployment has no upload endpoint. Point the field at a URL instead, or run npm run media:upload.',
      }
    }
    signed = (await res.json()) as typeof signed
    if (!res.ok || !signed.ok || !signed.url) {
      return { ok: false, error: signed.error ?? `Upload was refused (${res.status}).` }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { ok: false, error: 'Upload cancelled.' }
    }
    return {
      ok: false,
      error: `Could not reach the upload endpoint: ${
        err instanceof Error ? err.message : 'unknown error'
      }`,
    }
  }

  const put = await sendBytes(signed.url, file, signed.headers ?? {}, {
    onProgress,
    signal,
  })
  if (!put.ok) return put

  return { ok: true, key: `/${key}` }
}

/** The PUT itself. Separate because progress means XHR, and XHR means events. */
function sendBytes(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  { onProgress, signal }: UploadHandle,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)

    xhr.upload.onprogress = (e) => {
      onProgress?.(e.lengthComputable ? e.loaded / e.total : null)
    }
    xhr.onload = () => {
      onProgress?.(1)
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true })
        return
      }
      resolve({
        ok: false,
        error: `The bucket refused the upload (${xhr.status}). ${
          xhr.status === 403
            ? 'The signature may have expired — try again.'
            : 'Check the bucket’s CORS rules allow PUT from this site (infra/r2-cors.json).'
        }`,
      })
    }
    // A cross-origin PUT that CORS refuses arrives here with no status and no
    // detail — the browser will not say more — so this names the usual cause.
    xhr.onerror = () =>
      resolve({
        ok: false,
        error:
          'The upload was blocked before it started. The bucket has to allow PUT from this site — see infra/r2-cors.json and MEDIA.md.',
      })
    xhr.onabort = () => resolve({ ok: false, error: 'Upload cancelled.' })

    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}
