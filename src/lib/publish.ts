import type { SiteContent } from '@/types/content'

/**
 * The page's side of publishing.
 *
 * Thin on purpose: everything that matters — the password check, the token, the
 * commit — happens in api/publish.ts, where the browser cannot reach it. This
 * posts the content and turns whatever comes back into one sentence somebody
 * can act on.
 */

export interface PublishResult {
  ok: boolean
  error?: string
  /** The commit on GitHub, when there is one to link to. */
  commit?: string | null
  publishedAt?: string
  repo?: string
  branch?: string
}

export interface PublishStatus {
  /** False when the deployment has no token, or no functions at all. */
  configured: boolean
  /** Which environment variables are missing, when it is not configured. */
  missing: string[]
  repo: string | null
  branch: string | null
  /** Set when the endpoint itself could not be reached. */
  unavailable?: string
}

const ENDPOINT = '/api/publish'

/**
 * Whether this deployment can publish, asked once and cached.
 *
 * Worth asking up front rather than finding out when somebody presses the
 * button: the editor can then say "publishing is not set up on this
 * deployment" while they are still deciding whether to make the edit, and say
 * which variable is missing instead of a 501.
 */
let statusPromise: Promise<PublishStatus> | null = null

export function publishStatus(): Promise<PublishStatus> {
  statusPromise ??= (async () => {
    try {
      const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } })
      // A static deploy with no functions answers the SPA's index.html here,
      // which parses as neither JSON nor a reason — so say the plain thing.
      // A function that exists but crashed (a bad import, a runtime error)
      // answers 500 — not the same thing as having no endpoint, and not
      // fixed by setting environment variables. Say which it is.
      if (res.status >= 500 && res.status !== 501) {
        return {
          configured: false,
          missing: [],
          repo: null,
          branch: null,
          unavailable: `The publish function is failing (HTTP ${res.status}); check the deployment's function logs.`,
        }
      }
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) {
        return {
          configured: false,
          missing: [],
          repo: null,
          branch: null,
          unavailable:
            'This deployment has no publish endpoint, so edits stay in this browser.',
        }
      }
      return (await res.json()) as PublishStatus
    } catch {
      return {
        configured: false,
        missing: [],
        repo: null,
        branch: null,
        unavailable: 'Could not reach the publish endpoint.',
      }
    }
  })()
  return statusPromise
}

export async function publishContent(
  content: SiteContent,
  { password, message }: { password: string; message?: string },
): Promise<PublishResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password, content, message }),
    })

    if (!res.headers.get('content-type')?.includes('json')) {
      return {
        ok: false,
        error:
          'This deployment has no publish endpoint. Edits are saved in this browser; use Export JSON to hand them over.',
      }
    }

    const body = (await res.json()) as PublishResult
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? `Publishing failed (${res.status}).` }
    }
    return body
  } catch (err) {
    return {
      ok: false,
      error: `Could not reach the publish endpoint: ${
        err instanceof Error ? err.message : 'unknown error'
      }`,
    }
  }
}
