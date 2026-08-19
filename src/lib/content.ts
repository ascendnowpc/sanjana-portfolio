import type { Performance, SiteProfile } from '@/types/content'
import { PERFORMANCES } from '@/data/performances'
import { PROFILE } from '@/data/site'
import { isSupabaseConfigured, sbSelect } from './supabase'

/**
 * The one place the app asks "where does content come from?".
 *
 * Default: the bundled local data — zero network, instant, works offline.
 * With VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set: reads Supabase and
 * falls back to local data if the request fails, so a database outage
 * degrades to a stale-but-working site instead of a blank page.
 */

/** Row shape as it comes out of Postgres (snake_case, nested via the view). */
interface PerformanceRow extends Omit<Performance, 'videoSrc'> {
  video_src?: string
}

let cache: Promise<Performance[]> | null = null

async function fetchPerformances(): Promise<Performance[]> {
  if (!isSupabaseConfigured) return PERFORMANCES

  try {
    const rows = await sbSelect<PerformanceRow>('performances_full', {
      order: 'year.desc',
    })
    if (!rows.length) return PERFORMANCES
    return rows.map(({ video_src, ...rest }) => ({
      ...(rest as Performance),
      videoSrc: video_src,
    }))
  } catch (err) {
    console.warn('[content] falling back to bundled data:', err)
    return PERFORMANCES
  }
}

export function getPerformances(): Promise<Performance[]> {
  cache ??= fetchPerformances()
  return cache
}

export async function getPerformance(
  slug: string,
): Promise<Performance | undefined> {
  const all = await getPerformances()
  return all.find((p) => p.slug === slug)
}

export async function getProfile(): Promise<SiteProfile> {
  if (!isSupabaseConfigured) return PROFILE
  try {
    const rows = await sbSelect<SiteProfile>('profile', { limit: '1' })
    return rows[0] ?? PROFILE
  } catch {
    return PROFILE
  }
}

/** Test seam — lets a future test reset the module-level memo. */
export function __resetContentCache() {
  cache = null
}
