/**
 * The content model for the whole site.
 *
 * This is intentionally the single source of truth: the local data file, the
 * Supabase tables (see supabase/schema.sql) and the component props all speak
 * these shapes, so swapping the data source never touches a component.
 */

export type CategoryId =
  | 'solo-concert'
  | 'musical-theatre'
  | 'studio-session'
  | 'collaboration'

export interface Category {
  id: CategoryId
  label: string
  /** Shown under the filter chip on /work. */
  blurb: string
  /** Hex accent used for glows and rules when this category is active. */
  accent: string
}

export interface Track {
  id: string
  title: string
  /** Writer / composer / arranger credit. */
  composer?: string
  /** Seconds. Used for the scrubber when no file is attached yet. */
  duration: number
  /** Path or URL to an mp3/wav. Optional — the player falls back to a
   *  synthesised demo tone so the UI is testable before audio exists. */
  audioSrc?: string
  /** One-line liner note shown under the track title. */
  note?: string
}

export interface Credit {
  role: string
  name: string
}

export interface Performance {
  slug: string
  title: string
  /** Short line under the title, e.g. "Solo Concert — Symphony Hall". */
  subtitle: string
  category: CategoryId
  year: number
  venue: string
  city: string
  /** One sentence shown in the index overlay on hover. */
  blurb: string
  /** Long-form copy for the detail page. */
  description: string
  /** Character / billing, for theatre credits. */
  role?: string
  runtime?: string
  poster: string
  /** Optional mp4/webm. Tiles fall back to a Ken Burns poster when absent. */
  videoSrc?: string
  gallery: string[]
  credits: Credit[]
  tracks: Track[]
  /** Pulled forward in the index cloud and on /work. */
  featured?: boolean
  /** Per-item accent; falls back to the category accent. */
  accent?: string
}

export interface SitePressQuote {
  quote: string
  source: string
}

export interface SiteProfile {
  name: string
  role: string
  tagline: string
  bioShort: string
  bio: string[]
  basedIn: string
  vocalRange: string
  training: string[]
  portraits: string[]
  press: SitePressQuote[]
  stats: { value: string; label: string }[]
  contact: {
    email: string
    booking: string
    instagram: string
    youtube: string
    spotify: string
  }
}
