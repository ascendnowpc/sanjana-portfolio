import type {
  Performance,
  SiteContent,
  SiteProfile,
} from '@/types/content'
import { PERFORMANCES } from '@/data/performances'
import { CATEGORIES } from '@/data/categories'
import { MUSIC_COVERS, HOUSE_CLIP } from '@/data/music'
import { PORTRAIT, PROFILE, TESTIMONIALS } from '@/data/site'
import { UI } from '@/data/ui'
import { getPerformances, getProfile } from './content'
import { isSupabaseConfigured } from './supabase'

/**
 * The one mutable copy of the site's content, and the only thing that writes
 * it.
 *
 * Three layers, in order of authority:
 *
 *   1. `DEFAULT_CONTENT` — the bundled data modules. Always present, so the
 *      site renders correctly on a browser that has never seen the panel.
 *   2. Supabase, when it is configured. Replaces the archive and the profile
 *      in layer 1 once it resolves; see lib/content.ts.
 *   3. The admin's saved edits, from this browser's localStorage. These win
 *      over both, because somebody sat down and typed them.
 *
 * Layer 3 is per-browser and that is a real limitation, not a detail: edits
 * made here are visible to whoever made them and to nobody else. The panel
 * says so on its own face and offers the saved JSON for download, which is
 * what turns a local edit into a deployed one — commit the file, or load the
 * rows into Supabase. Anything more (a write path to the database) needs a
 * service key, and a service key in a bundle is a public service key.
 */

const KEY = 'sanjana.site-content.v1'

/** Bumped when a change to the shapes makes an older saved blob unreadable. */
const VERSION = 1

interface Saved {
  version: number
  content: DeepPartial<SiteContent>
}

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export const DEFAULT_CONTENT: SiteContent = {
  profile: PROFILE,
  portrait: PORTRAIT,
  testimonials: TESTIMONIALS,
  categories: CATEGORIES,
  performances: PERFORMANCES,
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
   * can set the flag it guards. It keeps the panel out of the way of a visitor
   * who wanders into /admin. It does not keep a determined stranger out, and
   * nothing that runs entirely in a page can. Real protection means a server
   * holding the password and the content behind it — see DATABASE.md.
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
 * field. But an array the admin has edited *is* the list — merging index by
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

function readSaved(): DeepPartial<SiteContent> | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Saved
    if (parsed?.version !== VERSION || !parsed.content) return null
    return parsed.content
  } catch {
    // Private mode, a blocked origin, or a half-written blob. The site is
    // supposed to work without this, so a failure here is not worth a warning
    // the visitor cannot act on.
    return null
  }
}

/**
 * Layers 1 and 3, composed.
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

/** Layer 1 (+2 once it lands), before the admin's edits. */
let base: SiteContent = DEFAULT_CONTENT
/** Layer 3. */
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

/**
 * Save a whole new content object.
 *
 * The full object is written rather than a diff against the defaults: a diff
 * would have to decide what "unchanged" means for an array of thirty-six
 * performances, and the honest answer is that it cannot. It is re-merged over
 * the defaults on read anyway (see `merge`), so a field added to the model
 * later still appears.
 */
export function saveContent(next: SiteContent): { ok: boolean; error?: string } {
  overrides = clone(next)
  emit()
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: VERSION, content: overrides } satisfies Saved),
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

/**
 * Whether layer 2 is still in the air.
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
 * Pull layer 2 in, once.
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
