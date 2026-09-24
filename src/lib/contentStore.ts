import type {
  Performance,
  SiteContent,
  SiteProfile,
} from '@/types/content'
import { PERFORMANCES } from '@/data/performances'
import { CATEGORIES } from '@/data/categories'
import { COVERS } from '@/data/covers'
import { MUSIC_COVERS, HOUSE_CLIP } from '@/data/music'
import { PORTRAIT, PROFILE, TESTIMONIALS } from '@/data/site'
import { UI } from '@/data/ui'
import { getPerformances, getProfile } from './content'
import { isSupabaseConfigured } from './supabase'
import PUBLISHED from '@/content/published.json'

/**
 * The one mutable copy of the site's content, and the only thing that writes
 * it.
 *
 * Four layers, in order of authority:
 *
 *   1. `BUNDLED` — the typed data modules. Always present, so the site renders
 *      correctly on a browser that has never seen the editor.
 *   2. `src/content/published.json` — what was last published *from the site*.
 *      It is a file in the repository, committed by the publish endpoint (see
 *      api/publish.ts), which is what makes an edit made in a browser a fact
 *      about the deploy rather than a fact about that browser. Empty until the
 *      first publish.
 *   3. Supabase, when it is configured. Replaces the archive and the profile
 *      once it resolves; see lib/content.ts.
 *   4. The editor's unpublished edits, from this browser's localStorage. These
 *      win over the rest, because somebody is in the middle of typing them.
 *
 * Layer 4 is per-browser, and that used to be the end of the story: an edit
 * was visible to whoever made it and to nobody else, and the only way out was
 * to export a JSON file and hand it to whoever deploys. Layer 2 is the way
 * out. `publishContent` in lib/publish.ts posts the composed content to a
 * function holding a GitHub token, the function commits it as layer 2, and the
 * deploy that follows carries the edit to everyone.
 *
 * Layer 4 is therefore a *draft*, and it is dropped once the deploy catches up
 * with it — see `readSaved`. Without that rule an editor who publishes would
 * go on seeing their own localStorage copy forever and could never tell
 * whether the publish had worked.
 */

const KEY = 'sanjana.site-content.v1'

/** Bumped when a change to the shapes makes an older saved blob unreadable. */
const VERSION = 1

interface Saved {
  version: number
  /** When these edits were written, so a later publish can supersede them. */
  savedAt?: number
  content: DeepPartial<SiteContent>
}

/** The shape of src/content/published.json. */
interface Published {
  version: number
  /** ISO stamp written by the publish endpoint. Null before the first one. */
  publishedAt: string | null
  content: DeepPartial<SiteContent>
}

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

/** Layer 1: what the code says, with nothing layered over it. */
const BUNDLED: SiteContent = {
  profile: PROFILE,
  portrait: PORTRAIT,
  testimonials: TESTIMONIALS,
  categories: CATEGORIES,
  performances: PERFORMANCES,
  covers: COVERS,
  music: {
    covers: MUSIC_COVERS,
    houseClip: { ...HOUSE_CLIP, to: HOUSE_CLIP.to ?? null },
  },
  ui: UI,
  /**
   * The door.
   *
   * It is checked in the browser, which means it is a latch and not a lock:
   * anybody who opens the bundle can read it, and anybody who opens devtools
   * can set the flag it guards. It keeps the editor out of the way of a
   * visitor who wanders into /admin. It does not keep a determined stranger
   * out, and nothing that runs entirely in a page can.
   *
   * Publishing is the part that had to be held properly, and it is: the
   * endpoint checks the password again on the server, against `ADMIN_PASSWORD`
   * in the deployment's environment, and the token that can write to the
   * repository never enters the page. So this latch decides who sees the
   * editing UI, and the server decides who can change the site. See
   * api/publish.ts and EDITING.md.
   */
  admin: { password: 'sanjana@admin' },
}

/** Structured clone, so an edit can never reach back into the defaults. */
function clone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T)
}

/**
 * Overlay `patch` onto `base`.
 *
 * Objects merge key by key; **arrays replace wholesale**. That asymmetry is
 * the point. A saved object that is missing a key added since it was written
 * picks the new key up from the defaults, so an old blob never blanks a new
 * field. But an array the editor has edited *is* the list — merging index by
 * index would resurrect a deleted performance the moment the defaults still
 * had one at that position.
 */
function merge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base
  if (patch === null) return patch as T
  if (Array.isArray(patch)) return clone(patch) as T
  if (
    typeof patch !== 'object' ||
    typeof base !== 'object' ||
    base === null ||
    Array.isArray(base)
  ) {
    return patch as T
  }

  const out = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    out[k] = merge((base as Record<string, unknown>)[k], v)
  }
  return out as T
}

const published = PUBLISHED as Published

/** Layers 1 + 2: the deploy's own content, before anybody's draft. */
export const DEFAULT_CONTENT: SiteContent =
  published.version === VERSION && published.content
    ? merge(BUNDLED, published.content)
    : BUNDLED

/** When the deploy's content was last published, in epoch ms. 0 if never. */
const publishedAt = published.publishedAt
  ? Date.parse(published.publishedAt) || 0
  : 0

/**
 * Layer 4, unless the deploy has already caught up with it.
 *
 * A draft older than the running deploy's publish stamp is one that has been
 * published and shipped, so keeping it would mean showing the editor a local
 * copy of content that is now in the code — and hiding every change anybody
 * else published since. Dropping it is what makes "publish" feel like it did
 * something.
 */
function readSaved(): DeepPartial<SiteContent> | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Saved
    if (parsed?.version !== VERSION || !parsed.content) return null
    if (publishedAt && (parsed.savedAt ?? 0) <= publishedAt) {
      localStorage.removeItem(KEY)
      return null
    }
    return parsed.content
  } catch {
    // Private mode, a blocked origin, or a half-written blob. The site is
    // supposed to work without this, so a failure here is not worth a warning
    // the visitor cannot act on.
    return null
  }
}

/**
 * Layers 1–2 (+3 once it lands) and 4, composed.
 *
 * `null` overrides mean "no edits saved", which is not the same thing as a
 * patch whose value is null — `merge` reads that second one as "set this field
 * to null", and `houseClip.to` genuinely is nullable. So the no-edits case is
 * answered here rather than inside `merge`, where it would collide with a
 * legitimate null and blank the whole object.
 */
function compose(): SiteContent {
  return overrides ? merge(base, overrides) : base
}

/** Layers 1–2 (+3 once it lands), before the editor's draft. */
let base: SiteContent = DEFAULT_CONTENT
/** Layer 4. */
let overrides: DeepPartial<SiteContent> | null = readSaved()
/** What everything actually reads. Recomputed, never mutated in place. */
let current: SiteContent = compose()

type Listener = (content: SiteContent) => void
const listeners = new Set<Listener>()

function emit() {
  current = compose()
  for (const l of listeners) l(current)
}

/** Current content. Stable between edits, so it is safe as a store snapshot. */
export function getContent(): SiteContent {
  return current
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** True when this browser is showing edits that are not in the deploy. */
export function hasOverrides(): boolean {
  return overrides !== null
}

/** When the running deploy's content was published. Null before the first. */
export function publishedStamp(): string | null {
  return published.publishedAt
}

/**
 * Show `next` on the site now, without writing it to storage.
 *
 * This is what a keystroke in the page calls. Inline editing is a live thing —
 * the site behind the caret *is* the preview — so an edit has to reach every
 * component that reads it in the same frame, and a localStorage write per
 * keystroke is both wasteful and a way to persist a half-typed word. The
 * editor calls `persistDraft` when the field is done with.
 */
export function applyDraft(next: SiteContent) {
  // Not cloned, deliberately. `setAtPath` builds `next` by copying only the
  // nodes along the path it changed, and `compose` copies every array it merges,
  // so what readers get already shares nothing mutable with the defaults — while
  // a `structuredClone` of the whole site on every keystroke is the one thing
  // here that would actually be felt while typing.
  //
  // The contract that comes with that: a caller hands this object over and does
  // not mutate it afterwards. Every caller in the codebase either built it fresh
  // (`setAtPath`) or holds it as React state (the panel's draft), both of which
  // already treat it as immutable.
  overrides = next
  emit()
}

/** Write whatever is live to this browser's storage. */
export function persistDraft(): { ok: boolean; error?: string } {
  if (!overrides) return { ok: true }
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: VERSION,
        savedAt: Date.now(),
        content: overrides,
      } satisfies Saved),
    )
    return { ok: true }
  } catch (err) {
    // The edit is live in this tab either way — it just will not survive a
    // reload. Saying which of those two happened is the whole point.
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Edits are live but not saved: ${err.message}`
          : 'Edits are live but could not be written to this browser’s storage.',
    }
  }
}

/**
 * Save a whole new content object: live, and written down.
 *
 * The full object is written rather than a diff against the defaults: a diff
 * would have to decide what "unchanged" means for an array of thirty-six
 * performances, and the honest answer is that it cannot. It is re-merged over
 * the defaults on read anyway (see `merge`), so a field added to the model
 * later still appears.
 */
export function saveContent(next: SiteContent): { ok: boolean; error?: string } {
  applyDraft(next)
  return persistDraft()
}

/** Throw the local edits away and go back to what the deploy ships. */
export function resetContent() {
  overrides = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to remove, or storage is blocked — the state above is the truth */
  }
  emit()
}

/** Replace everything from an exported file. Returns why, when it will not. */
export function importContent(json: string): { ok: boolean; error?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'That is not valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'That file does not contain a content object.' }
  }
  // Accept both shapes: a bare content object, and a whole export file with
  // its version wrapper. Somebody pasting half of an export should not have to
  // know which half we wanted.
  const body =
    'content' in (parsed as Record<string, unknown>)
      ? (parsed as Saved).content
      : (parsed as DeepPartial<SiteContent>)
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'That file does not contain a content object.' }
  }
  return saveContent(merge(DEFAULT_CONTENT, body))
}

/** The exact bytes the export button writes. */
export function exportContent(): string {
  return JSON.stringify({ version: VERSION, content: current }, null, 2)
}

/* ============================ editing by path ============================ */

/**
 * Where a value lives inside the content object, as the keys you would type.
 *
 * `['ui', 'about', 'headline', 0]` is the first line of the About page's
 * statement. Inline editing needs this because a component that renders one
 * string has to be able to write that one string back without knowing, or
 * rebuilding, the shape around it.
 */
export type ContentPath = readonly (string | number)[]

/** Read a value out of the live content. Undefined when the path is wrong. */
export function getAtPath(path: ContentPath, root: unknown = current): unknown {
  let node: unknown = root
  for (const key of path) {
    if (node == null || typeof node !== 'object') return undefined
    node = (node as Record<string | number, unknown>)[key]
  }
  return node
}

/**
 * A copy of `root` with `path` set to `value`.
 *
 * Copies only the nodes along the path and shares the rest, which is what lets
 * a keystroke in one field re-render that field's subtree and nothing else. A
 * numeric key makes an array where nothing exists yet, so a new row can be
 * written at an index that is not there.
 */
function setIn<T>(root: T, path: ContentPath, value: unknown): T {
  if (!path.length) return value as T
  const [key, ...rest] = path
  const isIndex = typeof key === 'number'
  const node: unknown =
    root == null || typeof root !== 'object' ? (isIndex ? [] : {}) : root

  if (Array.isArray(node)) {
    const next = node.slice()
    next[key as number] = setIn(node[key as number], rest, value)
    return next as T
  }
  const obj = node as Record<string | number, unknown>
  return { ...obj, [key]: setIn(obj[key], rest, value) } as T
}

/**
 * Set one field and show it immediately. Returns the whole new content.
 *
 * Nothing is written to storage — see `applyDraft`. Callers that are finishing
 * an edit rather than typing it call `persistDraft` afterwards.
 */
export function setAtPath(path: ContentPath, value: unknown): SiteContent {
  const next = setIn(current, path, value)
  applyDraft(next)
  return next
}

/**
 * Whether layer 3 is still in the air.
 *
 * False from the first frame when Supabase is not configured, which is the
 * default — there is nothing to wait for, so nothing should wait. The detail
 * page is the only reader: it holds instead of bouncing to 404 while a slug it
 * does not recognise might still be on its way from the database.
 */
let remotePending = isSupabaseConfigured
export function isRemotePending(): boolean {
  return remotePending
}

/**
 * Pull layer 3 in, once.
 *
 * Only ever touches `base`, so a database that comes back with the old copy
 * cannot undo an edit somebody just made. Called from `ContentProvider` on
 * mount; a no-op when Supabase is not configured, because `lib/content.ts`
 * resolves to the bundled data in that case and merging it changes nothing.
 */
let hydrated = false
export async function hydrateFromRemote() {
  if (hydrated) return
  hydrated = true
  try {
    const [performances, profile] = await Promise.all([
      getPerformances().catch(() => null),
      getProfile().catch(() => null),
    ])
    if (performances || profile) {
      base = {
        ...base,
        performances:
          (performances as Performance[] | null) ?? base.performances,
        profile: (profile as SiteProfile | null) ?? base.profile,
      }
    }
  } finally {
    // Always, and always with an emit: a reader waiting on `remotePending`
    // must be told the wait is over whether or not anything came back.
    remotePending = false
    emit()
  }
}
