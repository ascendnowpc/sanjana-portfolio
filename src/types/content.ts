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
  | 'classical-repertoire'
  | 'hindi-singing'
  | 'honor-choir'
  | 'collaboration'

export interface Category {
  id: CategoryId
  label: string
  /** The name as the /work index sets it: filter keys, the column beside each
   *  row, the section heading. Falls back to `label`, and only exists for the
   *  one category whose full name is too long to key. */
  short?: string
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
  /** Full recording. Played by the detail page; too heavy for a hover preview. */
  videoSrc?: string
  /** Short silent loop used for the hover preview on the index wall. Falls
   *  back to `videoSrc`, then to a Ken Burns move on the poster. */
  previewSrc?: string
  /** width / height of the footage. Tiles are cut to this so portrait phone
   *  video is not centre-cropped into a letterbox strip. Defaults to 16:9. */
  aspect?: number
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

/**
 * One card in the About page's testimonial run.
 *
 * A superset of `SitePressQuote` rather than a replacement for it: the quote
 * and the name are the same two facts, and everything added here exists to
 * fill a *card* — the line that says who is speaking, the work they are
 * speaking about, and a still to sit in the record's label. A press list is
 * three lines of type; a card that has to hold a screen on its own needs more
 * than a quotation mark.
 *
 * Local-only, like `PORTRAIT`. The `profile` table carries `press` and knows
 * nothing about this shape, so it is not on `SiteProfile` — see the note over
 * TESTIMONIALS in data/site.ts.
 */
export interface Testimonial {
  /** Who is speaking. Set beside the number, above the card. */
  source: string
  /** The grey line under the name: who they are, or where the notice ran. */
  role: string
  /** Small mono label inside the card — the night, the run, the record. */
  context: string
  quote: string
  /**
   * The still that sits in the record's label.
   *
   * A media key ("/media/…") or an absolute https URL — `mediaUrl` passes
   * absolute values through untouched, so one of these can point at a hosted
   * photograph without the file joining the bucket.
   */
  portrait: string
  /**
   * `object-position` for that still, when the middle of the frame is not the
   * part worth keeping. Omitted means centred.
   */
  focus?: string
  /**
   * Hex accent for the card's rim, per the reference's coloured cards.
   *
   * Same field as `Category.accent` and `Performance.accent`, and used the
   * same way: it is the one colour on an otherwise neutral element, and it
   * never touches the type or the ground. Off the palette's greyscale rule on
   * purpose — see the note over the tokens in index.css.
   */
  accent: string
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
