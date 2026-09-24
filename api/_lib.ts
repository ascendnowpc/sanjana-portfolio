import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * What the two endpoints share: the door, and the environment behind it.
 *
 * Files under api/ whose name starts with an underscore are not routes, so
 * this is importable by both without being reachable from the outside.
 *
 * These endpoints exist because a page cannot be trusted with the things they
 * hold. The site's own password latch lives in the bundle and decides who is
 * *shown* the editing UI; the token that can write to the repository and the
 * key that can write to the bucket live here, in the deployment's environment,
 * and never leave it. That split is the whole security model: a stranger who
 * reads the bundle gets the editing UI and no way to change anything anybody
 * else will see.
 */

/** An environment variable, or undefined when it is missing or blank. */
export function env(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Nothing here is cacheable: one is a write, the other reports live
      // configuration, and a cached "not configured" would be a bug that only
      // shows up for one editor and only sometimes.
      'cache-control': 'no-store',
    },
  })
}

/**
 * Constant-time comparison of two secrets.
 *
 * Digested first so the lengths always match — `timingSafeEqual` throws on
 * unequal lengths, and a thrown error is itself a signal about the length of
 * the real password.
 */
function sameSecret(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

export type Denial = { ok: false; response: Response }
export type Allowance = { ok: true }

/**
 * Check the password the page sent against the one in the environment.
 *
 * `ADMIN_PASSWORD` is required, and its absence is a refusal rather than a
 * fallback to the password in the bundle: that value is readable by anybody
 * who opens the site, so honouring it here would mean the whole world could
 * publish. An unconfigured deployment is one where the editing UI works, the
 * edits stay in the editor's browser, and publishing says why it cannot.
 */
export function authorise(password: unknown): Denial | Allowance {
  const expected = env('ADMIN_PASSWORD')
  if (!expected) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error:
            'Publishing is not set up on this deployment: ADMIN_PASSWORD is not set. See EDITING.md.',
        },
        501,
      ),
    }
  }
  if (typeof password !== 'string' || !password) {
    return { ok: false, response: json({ ok: false, error: 'No password.' }, 401) }
  }
  if (!sameSecret(password, expected)) {
    return {
      ok: false,
      response: json({ ok: false, error: 'That password is not right.' }, 401),
    }
  }
  return { ok: true }
}

/** Parse a JSON body, or say so. */
export async function readJson(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | Denial> {
  try {
    const body = (await request.json()) as unknown
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return {
        ok: false,
        response: json({ ok: false, error: 'Expected a JSON object.' }, 400),
      }
    }
    return { ok: true, body: body as Record<string, unknown> }
  } catch {
    return {
      ok: false,
      response: json({ ok: false, error: 'That request was not valid JSON.' }, 400),
    }
  }
}

/**
 * Which repository and branch a publish writes to.
 *
 * Vercel exports the repository it built from, so the usual case needs no
 * configuration at all — and taking the branch from the build means a publish
 * made on a preview deployment commits to that preview's branch rather than to
 * production, which is the behaviour somebody trying the editor out on a
 * preview URL would expect.
 */
export function repoTarget(): { owner: string; repo: string; branch: string } | null {
  const explicit = env('GITHUB_REPO')
  const branch = env('PUBLISH_BRANCH') ?? env('VERCEL_GIT_COMMIT_REF') ?? 'main'

  if (explicit?.includes('/')) {
    const [owner, repo] = explicit.split('/', 2)
    if (owner && repo) return { owner, repo, branch }
  }
  const owner = env('VERCEL_GIT_REPO_OWNER')
  const repo = env('VERCEL_GIT_REPO_SLUG')
  if (owner && repo) return { owner, repo, branch }
  return null
}
