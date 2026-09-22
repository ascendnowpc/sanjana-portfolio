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

/* ============================================================================
 * Everything below is what the admin panel edits.
 *
 * The site used to keep its facts in three places: typed data modules for the
 * archive and the profile, and string literals sitting in the JSX for every
 * label, heading and button on top of them. That second half was invisible to
 * anything but a code editor. These shapes pull it into the same model as the
 * first half, so "the content of this site" is one object with one type —
 * which is what makes a panel over it possible at all.
 * ========================================================================= */

/** A small-caps heading and its reversed-out final word. See `PORTRAIT`. */
export interface PortraitBeat {
  heading: string
  accent: string
  body: string
}

/** The About page's portrait column: one lead paragraph, then the beats. */
export interface PortraitCopy {
  lead: string
  beats: PortraitBeat[]
}

/**
 * The recording the index plays under itself.
 *
 * Named by slug rather than by path so it stays pinned to a real performance
 * in the archive; `from`/`to` cut an excerpt out of the take.
 */
export interface HouseClip {
  slug: string
  from: number
  /** Seconds, or null to play to the end of the file. */
  to: number | null
}

export interface MusicCopy {
  /** Cover art per category, keyed the same way `CATEGORIES` is. */
  covers: Partial<Record<CategoryId, string>>
  houseClip: HouseClip
}

/** A destination and the word that stands for it. */
export interface NavLinkCopy {
  to: string
  label: string
}

/** One word of the index's welcome sentence. `big` is the tracked display
 *  size, `small` the connective between them. */
export interface HomeToken {
  kind: 'big' | 'small'
  text: string
}

/** One word of the bottom sentence, where some of the words are the links. */
export interface HomeNavToken {
  kind: 'small' | 'link'
  text: string
  /** Only read when `kind` is `link`. */
  to?: string
}

/**
 * One word of the sound gate's diagonal.
 *
 * `size` is a multiple of the run's own font size and `drop` is how far the
 * word falls below the first one, in ems of its line — together they are what
 * lays the sentence across the screen on a slant instead of stacking it.
 */
export interface GateWord {
  word: string
  size: number
  drop: number
}

/**
 * Every fixed string on the site.
 *
 * Grouped by where it is read rather than by what it is, because that is how
 * somebody editing it will look for it: they are on a page, they can see the
 * word, and they want the field that holds it.
 *
 * A value written `{like this}` is a slot — see `fill()` in lib/copy.ts. The
 * slots a string accepts are named in the comment above it, and a template
 * that loses one simply stops substituting: nothing throws.
 */
export interface UiCopy {
  /** The browser tab and the crawler's summary. */
  meta: {
    title: string
    description: string
    /** The colour a mobile browser paints its chrome with. */
    themeColor: string
  }

  nav: {
    sections: NavLinkCopy[]
    /** The one lit key at the right of the bar — the errand, not a place. */
    cta: NavLinkCopy
    openMenu: string
    closeMenu: string
  }

  home: {
    /** The welcome sentence, one array per line. `{name}` is the profile's. */
    welcome: HomeToken[][]
    /** The sentence at the foot of the index, one array per line. */
    nav: HomeNavToken[][]
    driftHint: string
    /** Heading over the screen-reader-only index of every piece. */
    srHeading: string
  }

  soundGate: {
    words: GateWord[]
    /** What a screen reader is told the whole panel does. */
    enterLabel: string
    decline: string
  }

  work: {
    srTitle: string
    allFilter: string
    gridView: string
    listView: string
    filterLabel: string
    viewLabel: string
    empty: string
  }

  workDetail: {
    moreInfo: string
    credits: string
    stills: string
    previous: string
    next: string
    listen: string
    /** `{venue}` */
    listenAt: string
    meta: {
      year: string
      venue: string
      city: string
      role: string
      runtime: string
      recording: string
    }
    /** `{title}`, `{n}` */
    stillAlt: string
    /** `{title}` */
    playLabel: string
    jumpLabel: string
    noFootage: string
  }

  about: {
    /** The opening statement, one string per line. The break is deliberate. */
    headline: string[]
    /** The looping film the page opens on, and its first frame. */
    film: string
    filmPoster: string
    /** `{name}`, `{n}` */
    portraitAlt: string
  }

  portrait: {
    label: string
    /** `{percent}` */
    loading: string
  }

  testimonials: {
    heading: string
  }

  music: {
    heading: string
    recording: string
    recordings: string
    /** The link out of a card, into that discipline's corner of the archive. */
    watch: string
    /** `{album}` */
    openLabel: string
    play: string
    pause: string
    previous: string
    next: string
    /** `{title}` */
    seek: string
    volume: string
    mute: string
    unmute: string
    showList: string
    hideList: string
    /** Shown on a card whose audio file 404s from the media host. */
    audioMissing: string
  }

  player: {
    listen: string
    previous: string
    next: string
    play: string
    pause: string
    volume: string
    volumeShort: string
    /**
     * Shown when a track has no file and the player is sounding a synthesised
     * reference tone instead, so an empty `audioSrc` is visibly empty rather
     * than silently wrong.
     */
    demoNote: string
  }

  contact: {
    eyebrow: string
    heading: string
    enquiryLegend: string
    enquiryTypes: string[]
    fields: {
      name: string
      email: string
      date: string
      message: string
    }
    submit: string
    sending: string
    sent: string
    demoNote: string
    bookingLabel: string
    generalLabel: string
    elsewhereLabel: string
    basedLabel: string
  }

  footer: {
    siteHeading: string
    links: NavLinkCopy[]
    elsewhereHeading: string
    /** `{year}`, `{name}` */
    copyright: string
    rights: string
    adminLabel: string
  }

  notFound: {
    code: string
    heading: string
    body: string
    cta: string
  }

  gallery: {
    learnMore: string
  }

  /** The three link labels, shared by the footer and the contact page. */
  socials: {
    instagram: string
    youtube: string
    spotify: string
  }
}

/** What the admin panel asks for at the door. */
export interface AdminSettings {
  password: string
}

/**
 * The whole site, as one value.
 *
 * Read through `ContentProvider`; written by the admin panel; persisted to
 * this browser's localStorage and exportable as JSON. Every field on it is
 * editable from /admin, which is the invariant this type exists to hold: if
 * something is on the page and not on here, it cannot be changed without a
 * deploy.
 */
export interface SiteContent {
  profile: SiteProfile
  portrait: PortraitCopy
  testimonials: Testimonial[]
  categories: Category[]
  performances: Performance[]
  music: MusicCopy
  ui: UiCopy
  admin: AdminSettings
}
