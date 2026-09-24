import { authorise, env, json, readJson, repoTarget } from './_lib'

/**
 * Publish: turn what somebody typed on the site into a commit.
 *
 * This is the endpoint that makes the editor real. Every other part of it — the
 * inline fields, the panel, the draft in localStorage — changes the site in one
 * browser. This changes the code: it writes the whole content object to
 * `src/content/published.json` on the deployment's own branch, through the
 * GitHub contents API, and the deploy that GitHub's webhook triggers is what
 * carries the edit to everybody else.
 *
 * So the content has exactly two homes, and no third one to fall out of step:
 * the typed modules under src/data (what the site was built with) and this one
 * file (what has been edited since). `contentStore` merges the second over the
 * first, which is why publishing a single changed heading is a one-line diff on
 * a file rather than a rewrite of a data module — and why the commit is
 * readable as a commit: pretty-printed, one field to a line, reviewable in a
 * pull request like anything else.
 *
 * What it needs in the environment:
 *
 *   ADMIN_PASSWORD   the password, checked here rather than in the page
 *   GITHUB_TOKEN     a fine-grained token with Contents: read and write on
 *                    this repository, and nothing else
 *   GITHUB_REPO      owner/repo. Optional on Vercel, which exports it.
 *   PUBLISH_BRANCH   optional; defaults to the branch this deploy was built
 *                    from, so a preview publishes to the preview's branch
 *
 * GET reports whether those are set, so the editing UI can say "publishing is
 * not set up" up front instead of only when somebody presses the button.
 *
 * See EDITING.md for the walkthrough.
 */

/** The one file a publish writes. Read by src/lib/contentStore.ts. */
const CONTENT_PATH = 'src/content/published.json'

/** The version `contentStore` will accept. Bumped with the content shapes. */
const VERSION = 1

/** The top-level keys a real content object has. */
const REQUIRED_KEYS = [
  'profile',
  'portrait',
  'testimonials',
  'categories',
  'performances',
  'covers',
  'music',
  'ui',
  'admin',
] as const

/** A quarter of a megabyte of JSON is a big site; ten is a mistake. */
const MAX_BYTES = 4_000_000

const API = 'https://api.github.com'

function githubHeaders(token: string) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'sanjana-portfolio-publish',
    'x-github-api-version': '2022-11-28',
  }
}

/** Whether publishing is set up, and what it would write to. */
export function GET(): Response {
  const target = repoTarget()
  const missing = [
    env('ADMIN_PASSWORD') ? null : 'ADMIN_PASSWORD',
    env('GITHUB_TOKEN') ? null : 'GITHUB_TOKEN',
    target ? null : 'GITHUB_REPO',
  ].filter((x): x is string => x !== null)

  return json({
    configured: missing.length === 0,
    missing,
    repo: target ? `${target.owner}/${target.repo}` : null,
    branch: target?.branch ?? null,
    path: CONTENT_PATH,
  })
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJson(request)
  if (!parsed.ok) return parsed.response

  const allowed = authorise(parsed.body.password)
  if (!allowed.ok) return allowed.response

  const token = env('GITHUB_TOKEN')
  if (!token) {
    return json(
      {
        ok: false,
        error:
          'Publishing is not set up on this deployment: GITHUB_TOKEN is not set. See EDITING.md.',
      },
      501,
    )
  }
  const target = repoTarget()
  if (!target) {
    return json(
      {
        ok: false,
        error:
          'Publishing is not set up on this deployment: GITHUB_REPO is not set and this is not a Vercel git deployment. See EDITING.md.',
      },
      501,
    )
  }

  const content = parsed.body.content
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return json({ ok: false, error: 'No content object in that request.' }, 400)
  }
  // A content object missing a whole section would publish a site with that
  // section blanked. Cheap to check, and the one mistake here is unrecoverable
  // without a revert.
  const missing = REQUIRED_KEYS.filter((k) => !(k in content))
  if (missing.length) {
    return json(
      { ok: false, error: `That content is missing: ${missing.join(', ')}.` },
      400,
    )
  }

  const publishedAt = new Date().toISOString()
  // Pretty-printed and newline-terminated, because this file's other audience
  // is whoever reads the diff.
  const file = `${JSON.stringify({ version: VERSION, publishedAt, content }, null, 2)}\n`
  if (file.length > MAX_BYTES) {
    return json(
      { ok: false, error: 'That content is too large to publish.' },
      413,
    )
  }

  const message =
    typeof parsed.body.message === 'string' && parsed.body.message.trim()
      ? parsed.body.message.trim().slice(0, 160)
      : 'Content: publish edits made on the site'

  const url = `${API}/repos/${target.owner}/${target.repo}/contents/${CONTENT_PATH}`
  const headers = githubHeaders(token)

  try {
    // The blob's current sha, so the write is an update rather than a create.
    // A 404 is the ordinary first-publish case and not an error.
    let sha: string | undefined
    const head = await fetch(
      `${url}?ref=${encodeURIComponent(target.branch)}`,
      { headers },
    )
    if (head.ok) {
      const body = (await head.json()) as { sha?: string }
      sha = body.sha
    } else if (head.status !== 404) {
      return json(
        {
          ok: false,
          error: await describeGithubFailure(head, target.owner, target.repo),
        },
        502,
      )
    }

    const put = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `${message}\n\nPublished from the site's editor at ${publishedAt}.`,
        // Buffer rather than btoa: the content is full of typographic
        // punctuation, and btoa throws on anything above U+00FF.
        content: Buffer.from(file, 'utf8').toString('base64'),
        branch: target.branch,
        sha,
      }),
    })

    if (!put.ok) {
      return json(
        {
          ok: false,
          error: await describeGithubFailure(put, target.owner, target.repo),
        },
        502,
      )
    }

    const body = (await put.json()) as {
      commit?: { html_url?: string; sha?: string }
    }
    return json({
      ok: true,
      publishedAt,
      commit: body.commit?.html_url ?? null,
      sha: body.commit?.sha ?? null,
      repo: `${target.owner}/${target.repo}`,
      branch: target.branch,
    })
  } catch (err) {
    return json(
      {
        ok: false,
        error: `Could not reach GitHub: ${err instanceof Error ? err.message : 'unknown error'}`,
      },
      502,
    )
  }
}

/**
 * Turn a GitHub failure into a sentence the editor can act on.
 *
 * The status codes here all mean something specific and all mean the same thing
 * to somebody reading "502 Bad Gateway": the token is wrong, or the branch is,
 * or somebody else committed first. Each of those has a different next step,
 * and this is the only place that knows which one happened.
 */
async function describeGithubFailure(
  res: Response,
  owner: string,
  repo: string,
): Promise<string> {
  let detail = ''
  try {
    const body = (await res.json()) as { message?: string }
    detail = body.message ?? ''
  } catch {
    /* an empty or non-JSON body; the status is the whole story */
  }

  switch (res.status) {
    case 401:
      return 'GitHub rejected the token (401). GITHUB_TOKEN is wrong or has expired.'
    case 403:
      return `GitHub refused the write (403). The token needs Contents: read and write on ${owner}/${repo}.${detail ? ` ${detail}` : ''}`
    case 404:
      return `GitHub cannot see ${owner}/${repo} (404). Check GITHUB_REPO, and that the token is allowed to reach this repository.`
    case 409:
      return 'Somebody else published while this was in flight (409). Reload the site and publish again.'
    case 422:
      return `GitHub would not accept the commit (422).${detail ? ` ${detail}` : ' The branch may not exist.'}`
    default:
      return `GitHub returned ${res.status}.${detail ? ` ${detail}` : ''}`
  }
}
