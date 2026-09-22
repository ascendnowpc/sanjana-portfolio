import type { UiCopy } from '@/types/content'

/**
 * Every fixed string on the site, in one place.
 *
 * These used to live where they were rendered — `'Grid View'` inside Work.tsx,
 * `'Say hello'` inside Contact.tsx, the seven words of the sound gate inside
 * SoundGate.tsx. That is the right place for a string nobody but a developer
 * will ever change, and the wrong place for a site whose owner should be able
 * to change all of it.
 *
 * So the components now read these through `useUi()` and this file is the
 * default they fall back to. Nothing here is decorative: a value removed from
 * this object is a word that disappears from the page.
 *
 * `{name}`-style slots are filled by `fill()` in lib/copy.ts.
 */
export const UI: UiCopy = {
  meta: {
    title: 'SANJANA — Vocalist',
    description:
      'Sanjana — vocalist, performer, and recording artist. Solo concerts, musical theatre, and studio sessions.',
    themeColor: '#111111',
  },

  nav: {
    sections: [
      { to: '/work', label: 'Work' },
      { to: '/about', label: 'About' },
    ],
    cta: { to: '/contact', label: 'Contact' },
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },

  home: {
    // Four lines. The second carries the name, which is why it is a slot and
    // not typed out — the wordmark, the preloader and this sentence are all
    // the same fact and must not be able to disagree.
    welcome: [
      [{ kind: 'small', text: 'Welcome' }],
      [
        { kind: 'small', text: 'to' },
        { kind: 'big', text: '{name}’S' },
        { kind: 'small', text: 'universe' },
      ],
      [
        { kind: 'small', text: 'of' },
        { kind: 'big', text: 'Solo Concerts' },
        { kind: 'big', text: '+' },
        { kind: 'big', text: 'Musical Theatre' },
      ],
      [
        { kind: 'small', text: 'and' },
        { kind: 'big', text: 'Honor Choir' },
      ],
    ],
    nav: [
      [
        { kind: 'small', text: 'the' },
        { kind: 'link', text: 'Work', to: '/work' },
        { kind: 'small', text: 'and' },
        { kind: 'link', text: 'About', to: '/about' },
        { kind: 'small', text: 'me' },
      ],
      [
        { kind: 'small', text: 'or' },
        { kind: 'link', text: 'Contact', to: '/contact' },
      ],
    ],
    driftHint: 'Move your cursor to look around',
    srHeading: 'All work',
  },

  soundGate: {
    words: [
      { word: 'Click', size: 1, drop: 0 },
      { word: 'anywhere', size: 0.92, drop: 1.3 },
      { word: 'to', size: 0.8, drop: 2.65 },
      { word: 'turn', size: 0.86, drop: 3.15 },
      { word: 'on', size: 0.76, drop: 3.85 },
      { word: 'your', size: 0.9, drop: 5.15 },
      { word: 'sound', size: 0.95, drop: 6.4 },
    ],
    enterLabel: 'Enter with sound',
    decline: 'Enter without sound',
  },

  work: {
    srTitle: 'Work — the archive',
    allFilter: 'All',
    gridView: 'Grid View',
    listView: 'List View',
    filterLabel: 'Filter the archive by category',
    viewLabel: 'Choose how the archive is laid out',
    empty: 'Nothing filed under this category yet.',
  },

  workDetail: {
    moreInfo: 'More info',
    credits: 'Credits',
    stills: 'Stills',
    previous: 'Previous',
    next: 'Next',
    listen: 'Listen',
    listenAt: 'Listen — {venue}',
    meta: {
      year: 'Year',
      venue: 'Venue',
      city: 'City',
      role: 'Role',
      runtime: 'Runtime',
      recording: 'Recording',
    },
    stillAlt: '{title} — still {n}',
    playLabel: 'Play {title}',
    jumpLabel: 'Jump to the recording',
    noFootage: 'Footage in the edit — press play for the recording',
  },

  about: {
    // Two deliberate lines, not a wrap: at this weight the break is part of
    // the composition. Adding a third line is supported and will simply stack.
    headline: ['A voice for every', 'room it enters'],
    // The size is in the key on purpose — R2 sends an immutable one-year cache
    // header, so a re-cut has to arrive under a new name to be seen at all.
    film: '/media/video/about-intro-1080.mp4',
    filmPoster: '/media/posters/about-intro.jpg',
    portraitAlt: '{name} — portrait {n}',
  },

  portrait: {
    label: 'Portrait',
    loading: 'Loading portrait — {percent}%',
  },

  testimonials: {
    heading: 'Testimonials',
  },

  music: {
    heading: 'Music',
    recording: 'Recording',
    recordings: 'Recordings',
    watch: 'Watch',
    openLabel: 'Open {album}',
    play: 'Play',
    pause: 'Pause',
    previous: 'Previous recording',
    next: 'Next recording',
    seek: 'Seek within {title}',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    showList: 'Show the recordings',
    hideList: 'Hide the recordings',
    audioMissing: 'Audio for this take is not on the media host yet.',
  },

  player: {
    listen: 'Listen',
    previous: 'Previous track',
    next: 'Next track',
    play: 'Play',
    pause: 'Pause',
    volume: 'Volume',
    volumeShort: 'Vol',
    demoNote:
      'No audio file attached yet — the transport is running a synthesised reference tone so the player can be tested. Attach a recording to hear the real take.',
  },

  contact: {
    eyebrow: 'Contact',
    heading: 'Say hello',
    enquiryLegend: 'Enquiry type',
    enquiryTypes: [
      'Solo concert',
      'Theatre casting',
      'Session vocals',
      'Collaboration',
    ],
    fields: {
      name: 'Your name',
      email: 'Email',
      date: 'Date or window',
      message: 'Tell me about the room',
    },
    submit: 'Send enquiry',
    sending: 'Sending…',
    sent: 'Received — thank you',
    demoNote:
      'This form is a front-end demo — nothing was sent. Wire it to Supabase or an email service before going live.',
    bookingLabel: 'Booking',
    generalLabel: 'General',
    elsewhereLabel: 'Elsewhere',
    basedLabel: 'Based in',
  },

  footer: {
    siteHeading: 'Site',
    links: [
      { to: '/work', label: 'The Work' },
      { to: '/about', label: 'About' },
      { to: '/contact', label: 'Contact' },
    ],
    elsewhereHeading: 'Elsewhere',
    copyright: '© {year} {name}',
    rights: 'All performances and recordings by arrangement.',
    adminLabel: 'Admin login',
  },

  notFound: {
    code: '404',
    heading: 'Nothing on this stage',
    body: 'That page has struck its set. Try the index instead.',
    cta: 'Back to the index',
  },

  gallery: {
    learnMore: 'Learn more',
  },

  socials: {
    instagram: 'Instagram',
    youtube: 'YouTube',
    spotify: 'Spotify',
  },
}
