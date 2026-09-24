import { createHash, createHmac } from 'node:crypto'
import { authorise, env, json, readJson } from './_lib'

/**
 * Hand the browser a one-off permission to write one file into the bucket.
 *
 * Media does not go through this function — it goes *past* it. The editor asks
 * for a signed URL, this signs one for exactly that key, and the browser then
 * PUTs the file straight to R2. Which is not an optimisation: a serverless
 * request body caps out at a few megabytes and a recording of a concert is
 * several hundred, so a proxy upload cannot work at all. The signature is
 * scoped to the one key and expires in fifteen minutes, so the page is never
 * holding anything it could reuse.
 *
 * What it needs in the environment:
 *
 *   ADMIN_PASSWORD         as with publishing — checked here, not in the page
 *   R2_ACCOUNT_ID          the Cloudflare account the bucket belongs to
 *   R2_ACCESS_KEY_ID       an R2 API token with Object Read & Write on it
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET              defaults to sanjana-portfolio-media
 *
 * The bucket also has to allow the site's origin to PUT — see infra/r2-cors.json
 * and MEDIA.md. Without that the browser's upload is refused before it starts,
 * which is the one failure here that looks like a bug in the page.
 *
 * GET reports whether uploading is available, so the editor can say so up front.
 */

const REGION = 'auto'
const SERVICE = 's3'
const EXPIRES = 900
const DEFAULT_BUCKET = 'sanjana-portfolio-media'

/**
 * Keys must land under media/, and may not climb out of it.
 *
 * The signature is the bucket's whole authority over what gets written, so this
 * is the only thing standing between a signed URL and an overwritten
 * index.html. Deliberately strict: lowercase, digits, dash, underscore, dot and
 * slash, and no `..` anywhere.
 */
const KEY_SHAPE = /^media\/[A-Za-z0-9][A-Za-z0-9._/-]*\.[A-Za-z0-9]+$/

/** What the site actually serves. See src/lib/media.ts. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

function config(): R2Config | null {
  const accountId = env('R2_ACCOUNT_ID')
  const accessKeyId = env('R2_ACCESS_KEY_ID')
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
  if (!accountId || !accessKeyId || !secretAccessKey) return null
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket: env('R2_BUCKET') ?? DEFAULT_BUCKET,
  }
}

export function GET(): Response {
  const r2 = config()
  const missing = [
    env('ADMIN_PASSWORD') ? null : 'ADMIN_PASSWORD',
    env('R2_ACCOUNT_ID') ? null : 'R2_ACCOUNT_ID',
    env('R2_ACCESS_KEY_ID') ? null : 'R2_ACCESS_KEY_ID',
    env('R2_SECRET_ACCESS_KEY') ? null : 'R2_SECRET_ACCESS_KEY',
  ].filter((x): x is string => x !== null)

  return json({
    configured: missing.length === 0,
    missing,
    bucket: r2?.bucket ?? null,
    cacheControl: CACHE_CONTROL,
    expiresIn: EXPIRES,
  })
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJson(request)
  if (!parsed.ok) return parsed.response

  const allowed = authorise(parsed.body.password)
  if (!allowed.ok) return allowed.response

  const r2 = config()
  if (!r2) {
    return json(
      {
        ok: false,
        error:
          'Uploading is not set up on this deployment: the R2 keys are not set. See EDITING.md.',
      },
      501,
    )
  }

  const key = typeof parsed.body.key === 'string' ? parsed.body.key : ''
  if (!KEY_SHAPE.test(key) || key.includes('..') || key.includes('//')) {
    return json(
      {
        ok: false,
        error:
          'That is not a usable media key. It has to look like media/video/name.mp4.',
      },
      400,
    )
  }

  const contentType =
    typeof parsed.body.contentType === 'string' && parsed.body.contentType
      ? parsed.body.contentType
      : 'application/octet-stream'

  const url = presignPut(r2, key)

  return json({
    ok: true,
    url,
    method: 'PUT',
    // The headers the browser must send — they are unsigned, so R2 stores them
    // as the object's own metadata without them having to be in the signature.
    headers: { 'content-type': contentType, 'cache-control': CACHE_CONTROL },
    key,
    expiresIn: EXPIRES,
  })
}

/* ============================== signature ============================== */

/**
 * A presigned PUT, by SigV4.
 *
 * Written out rather than pulled in from the AWS SDK, which is twelve megabytes
 * of dependency for one signature, in a function whose whole job is this one
 * signature. The steps are the specification's, in its order, and the comments
 * name the two that are easy to get wrong.
 */
function presignPut(r2: R2Config, key: string): string {
  const host = `${r2.accountId}.r2.cloudflarestorage.com`
  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const date = amzDate.slice(0, 8)
  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`

  // Only `host` is signed. Anything else the browser sends — the content type,
  // the cache header — is stored by R2 but stays out of the signature, so the
  // upload cannot fail because a browser normalised a header we promised.
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${r2.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(EXPIRES),
    'X-Amz-SignedHeaders': 'host',
  })

  // Each path segment is escaped on its own: the slashes between them are part
  // of the path, and encoding them turns one key into one very odd filename.
  const canonicalUri = `/${r2.bucket}/${key}`
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    // Sorted, which URLSearchParams does not do for us.
    [...query.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&'),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n')

  const hmac = (key: Buffer | string, data: string) =>
    createHmac('sha256', key).update(data, 'utf8').digest()

  const signature = createHmac(
    'sha256',
    hmac(
      hmac(hmac(hmac(`AWS4${r2.secretAccessKey}`, date), REGION), SERVICE),
      'aws4_request',
    ),
  )
    .update(stringToSign, 'utf8')
    .digest('hex')

  query.set('X-Amz-Signature', signature)
  return `https://${host}${canonicalUri}?${query}`
}
