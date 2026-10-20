import type { UiCopy } from '@/types/content'

/**
 * Every fixed string on the site, in one place.
 *
 * These used to live where they were rendered — `'Grid View'` inside Work.tsx,
 * `'Reach out'` inside Contact.tsx. That is the right place for a string nobody but a developer
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
      'Sanjana — vocalist based in Antwerp, Belgium. Solo concerts, musical theatre, Hindi singing and honor choir.',
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
    indexView: 'Index view',
    srHeading: 'All work',
  },

  // The button in the bottom-left corner of every page. Nothing plays until it
  // is pressed; while the song plays it shows the song's name instead.
  sound: {
    play: 'Hear me sing',
    pause: 'Pause the song',
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
    // One entry a line, broken where the phrase breaks. The page sets these
    // at the size of its longest line, so lines of similar length read best.
    headline: ['From the', 'first note'],
    // The size is in the key on purpose — R2 sends an immutable one-year cache
    // header, so a re-cut has to arrive under a new name to be seen at all.
    film: '/media/video/about-intro-1080.mp4',
    filmPoster: '/media/posters/about-intro.jpg',
    portraitAlt: '{name} — portrait {n}',
    // The two keys over the listening shelf. Both are plain words on purpose:
    // they are read as a choice between two bodies of work, not as headings.
    shelfTabs: {
      recordings: 'Recordings',
      covers: 'Musical covers',
    },
  },

  portrait: {
    label: 'Portrait',
    loading: 'Loading portrait — {percent}%',
  },

  covers: {
    heading: 'Musical covers',
    empty: 'No covers here yet.',
    watch: 'Watch',
    closeVideo: 'Close',
    videoLabel: '{title} — video',
    original: 'Originally {artist}',
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
    heading: 'Reach out',
    fields: {
      name: 'Your name',
      email: 'Your email',
      message: 'Your message',
    },
    submit: 'Send message',
    sending: 'Sending…',
    sent: 'Sent — thank you',
    sentNote: 'Thank you for reaching out — your message is on its way. I’ll reply to the address you gave.',
    failedNote: 'Your message could not be sent. Please email me at {email} instead.',
    generalLabel: 'Email',
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
    emailHeading: 'Email',
    elsewhereHeading: 'Elsewhere',
    copyright: '© {year} {name}',
    rights: 'All rights reserved.',
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
