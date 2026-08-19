import type { Performance } from '@/types/content'

/**
 * PLACEHOLDER CONTENT.
 *
 * Every entry below is dummy copy paired with a generated stage-still so the
 * site is fully explorable before real media exists. To go live:
 *
 *   1. drop real files into public/media/  (or point them at a CDN URL)
 *   2. rewrite the fields here — or flip to Supabase and this file becomes
 *      the offline fallback only (see src/lib/content.ts + DATABASE.md)
 *
 * `videoSrc` is deliberately omitted everywhere: tiles and the detail player
 * both degrade to a slow Ken Burns move on the poster when it is missing, so
 * nothing breaks while footage is still being cut.
 */

const poster = (slug: string) => `/media/posters/${slug}.jpg`

export const PERFORMANCES: Performance[] = [
  {
    slug: 'midnight-bloom-live',
    title: 'Midnight Bloom',
    subtitle: 'Solo Concert — The Grand Arena',
    category: 'solo-concert',
    year: 2025,
    venue: 'The Grand Arena',
    city: 'Mumbai',
    blurb: 'Ninety minutes, one voice, and a room of four thousand that went completely quiet in the second act.',
    description:
      'The closing night of the Midnight Bloom run, and the first time the full arrangement was performed with a live string section. The set moves from the near-whispered opening of "Paper Lanterns" through to a stripped final encore taken entirely without amplification — the recording you can hear below is the house desk feed, unedited.',
    poster: poster('midnight-bloom-live'),
    gallery: [poster('midnight-bloom-live'), poster('solstice-open-air'), poster('unplugged-at-the-chapel')],
    runtime: '92 min',
    featured: true,
    accent: '#4fd8e8',
    credits: [
      { role: 'Vocals & Musical Direction', name: 'Sanjana' },
      { role: 'Piano', name: 'Devika Rao' },
      { role: 'Strings', name: 'The Coastline Quartet' },
      { role: 'Front of House', name: 'Marcus Bell' },
    ],
    tracks: [
      { id: 'mb-1', title: 'Paper Lanterns', composer: 'Sanjana', duration: 254, note: 'Opening — voice and room mic only.' },
      { id: 'mb-2', title: 'Undertow', composer: 'Sanjana / D. Rao', duration: 301 },
      { id: 'mb-3', title: 'Midnight Bloom', composer: 'Sanjana', duration: 348, note: 'First live outing with strings.' },
      { id: 'mb-4', title: 'Hold the Line (encore)', composer: 'Trad. arr. Sanjana', duration: 221, note: 'Unamplified.' },
    ],
  },
  {
    slug: 'wildflower-tour-night-3',
    title: 'Wildflower — Night Three',
    subtitle: 'Solo Concert — Tour',
    category: 'solo-concert',
    year: 2025,
    venue: 'Riverside Hall',
    city: 'Bengaluru',
    blurb: 'The third night of the Wildflower run, and the one where the setlist got torn up an hour before doors.',
    description:
      'A tour date that turned into something else. A cancelled support slot left forty extra minutes, so the band worked up three unrehearsed covers in the afternoon and played them cold. Two of them stayed in the set for the rest of the run.',
    poster: poster('wildflower-tour-night-3'),
    gallery: [poster('wildflower-tour-night-3'), poster('midnight-bloom-live')],
    runtime: '78 min',
    featured: true,
    accent: '#2fd6b8',
    credits: [
      { role: 'Vocals', name: 'Sanjana' },
      { role: 'Guitar', name: 'Ilya Novak' },
      { role: 'Drums', name: 'Rhea Kapoor' },
      { role: 'Bass', name: 'Tomas Vidal' },
    ],
    tracks: [
      { id: 'wf-1', title: 'Wildflower', composer: 'Sanjana', duration: 279 },
      { id: 'wf-2', title: 'Seventeen Winters', composer: 'Sanjana', duration: 233 },
      { id: 'wf-3', title: 'Blue Hour', composer: 'Sanjana / I. Novak', duration: 312, note: 'Unrehearsed — first take, kept as-is.' },
    ],
  },
  {
    slug: 'orchestral-night-symphony-hall',
    title: 'Orchestral Night',
    subtitle: 'Solo Concert — with the City Symphony',
    category: 'solo-concert',
    year: 2024,
    venue: 'Symphony Hall',
    city: 'Delhi',
    blurb: 'Original songs rebuilt for a fifty-two piece orchestra, performed once and never repeated.',
    description:
      'A one-night commission: six songs from the back catalogue rescored for full orchestra by Devika Rao, performed with the City Symphony under conductor Anand Iyer. The arrangements have never been played since — this is the only recording that exists.',
    poster: poster('orchestral-night-symphony-hall'),
    gallery: [poster('orchestral-night-symphony-hall'), poster('unplugged-at-the-chapel')],
    runtime: '64 min',
    featured: true,
    accent: '#3f7dfb',
    credits: [
      { role: 'Soloist', name: 'Sanjana' },
      { role: 'Orchestration', name: 'Devika Rao' },
      { role: 'Conductor', name: 'Anand Iyer' },
      { role: 'Orchestra', name: 'City Symphony' },
    ],
    tracks: [
      { id: 'on-1', title: 'Overture / Undertow', composer: 'arr. D. Rao', duration: 402 },
      { id: 'on-2', title: 'Cathedral Glass', composer: 'Sanjana', duration: 356 },
      { id: 'on-3', title: 'Paper Lanterns (orchestral)', composer: 'arr. D. Rao', duration: 388 },
    ],
  },
  {
    slug: 'acoustic-rooftop-set',
    title: 'Rooftop, 6AM',
    subtitle: 'Solo Concert — Sunrise Session',
    category: 'solo-concert',
    year: 2024,
    venue: 'Anand House Rooftop',
    city: 'Mumbai',
    blurb: 'Forty people, no PA, and the sound of the city waking up underneath the last song.',
    description:
      'An invitation-only sunrise set played entirely acoustic on a rooftop, with the audience sitting on the floor. Traffic noise, birds and a passing train all made the recording — none of it was cleaned up.',
    poster: poster('acoustic-rooftop-set'),
    gallery: [poster('acoustic-rooftop-set')],
    runtime: '41 min',
    accent: '#7f9dbb',
    credits: [
      { role: 'Vocals & Guitar', name: 'Sanjana' },
      { role: 'Recording', name: 'Field stereo pair' },
    ],
    tracks: [
      { id: 'ar-1', title: 'Slow Burn', composer: 'Sanjana', duration: 264 },
      { id: 'ar-2', title: 'Kite String', composer: 'Sanjana', duration: 198 },
      { id: 'ar-3', title: 'First Light', composer: 'Sanjana', duration: 287, note: 'Sung as the sun came up.' },
    ],
  },
  {
    slug: 'unplugged-at-the-chapel',
    title: 'Unplugged at the Chapel',
    subtitle: 'Solo Concert — Acoustic',
    category: 'solo-concert',
    year: 2023,
    venue: 'St. Brigid Chapel',
    city: 'Goa',
    blurb: 'A stone room with an eleven-second reverb tail, used as the only effect on the whole show.',
    description:
      'Performed in a 400-year-old chapel chosen entirely for its acoustics. No reverb was added in the mix — everything you hear is the room. The arrangement was rewritten to leave space for the decay, which means most of the set sits at half its usual tempo.',
    poster: poster('unplugged-at-the-chapel'),
    gallery: [poster('unplugged-at-the-chapel'), poster('acoustic-rooftop-set')],
    runtime: '55 min',
    accent: '#9df3ff',
    credits: [
      { role: 'Vocals', name: 'Sanjana' },
      { role: 'Harmonium', name: 'Devika Rao' },
      { role: 'Recording & Mix', name: 'Leon Marsh' },
    ],
    tracks: [
      { id: 'uc-1', title: 'Vespers', composer: 'Trad. arr. Sanjana', duration: 341 },
      { id: 'uc-2', title: 'Cathedral Glass', composer: 'Sanjana', duration: 372 },
    ],
  },
  {
    slug: 'solstice-open-air',
    title: 'Solstice Open Air',
    subtitle: 'Solo Concert — Festival Headline',
    category: 'solo-concert',
    year: 2023,
    venue: 'Solstice Grounds',
    city: 'Pune',
    blurb: 'The first headline slot — nine thousand people and a storm that arrived two songs early.',
    description:
      'A festival headline set cut short by weather at the eighty minute mark. The final song was performed with the PA already powered down, led by the crowd. The recording ends where the power did.',
    poster: poster('solstice-open-air'),
    gallery: [poster('solstice-open-air'), poster('wildflower-tour-night-3')],
    runtime: '80 min',
    accent: '#2fd6b8',
    credits: [
      { role: 'Vocals', name: 'Sanjana' },
      { role: 'Band', name: 'The Undertow' },
      { role: 'Lighting Design', name: 'Priya Nair' },
    ],
    tracks: [
      { id: 'so-1', title: 'Wildflower', composer: 'Sanjana', duration: 268 },
      { id: 'so-2', title: 'Undertow', composer: 'Sanjana / D. Rao', duration: 318 },
      { id: 'so-3', title: 'Hold the Line', composer: 'Trad. arr. Sanjana', duration: 244, note: 'Sung with no PA.' },
    ],
  },

  {
    slug: 'hadestown-persephone',
    title: 'Hadestown',
    subtitle: 'Musical Theatre — Persephone',
    category: 'musical-theatre',
    year: 2025,
    venue: 'The Prithvi',
    city: 'Mumbai',
    role: 'Persephone',
    blurb: 'Six weeks as Persephone, playing the seasons turning over in a room with no wings and no fly tower.',
    description:
      'A staging built for a room with almost no technical capacity, which forced every transition to happen in full view of the audience. Persephone was played closer to exhausted than glamorous — a choice made in week two of rehearsals and kept for the whole run.',
    poster: poster('hadestown-persephone'),
    gallery: [poster('hadestown-persephone'), poster('cabaret-the-blue-room')],
    runtime: '2h 25m',
    featured: true,
    accent: '#f0a23c',
    credits: [
      { role: 'Persephone', name: 'Sanjana' },
      { role: 'Director', name: 'Farah Sheikh' },
      { role: 'Musical Director', name: 'Devika Rao' },
      { role: 'Choreography', name: 'Nikhil Sen' },
    ],
    tracks: [
      { id: 'hd-1', title: 'Livin’ It Up on Top', composer: 'A. Mitchell', duration: 243 },
      { id: 'hd-2', title: 'Our Lady of the Underground', composer: 'A. Mitchell', duration: 316, note: 'Act two opener.' },
      { id: 'hd-3', title: 'Promises', composer: 'A. Mitchell', duration: 198 },
    ],
  },
  {
    slug: 'chicago-roxie-hart',
    title: 'Chicago',
    subtitle: 'Musical Theatre — Roxie Hart',
    category: 'musical-theatre',
    year: 2024,
    venue: 'Royal Opera House',
    city: 'Mumbai',
    role: 'Roxie Hart',
    blurb: 'Eight shows a week as Roxie, and the vocal notes from the first week that changed the whole run.',
    description:
      'A revival staged in the round, which meant no fourth wall to play to and an audience visible from every angle. Roxie’s monologue was re-blocked nightly depending on where the loudest laugh came from.',
    poster: poster('chicago-roxie-hart'),
    gallery: [poster('chicago-roxie-hart'), poster('velvet-room-jazz-standards')],
    runtime: '2h 30m',
    accent: '#f0568f',
    credits: [
      { role: 'Roxie Hart', name: 'Sanjana' },
      { role: 'Director', name: 'Gabriel Ohene' },
      { role: 'Musical Director', name: 'Leon Marsh' },
      { role: 'Choreography', name: 'Nikhil Sen' },
    ],
    tracks: [
      { id: 'ch-1', title: 'Roxie', composer: 'Kander & Ebb', duration: 292 },
      { id: 'ch-2', title: 'Nowadays', composer: 'Kander & Ebb', duration: 214 },
      { id: 'ch-3', title: 'My Own Best Friend', composer: 'Kander & Ebb', duration: 267 },
    ],
  },
  {
    slug: 'cabaret-the-blue-room',
    title: 'Cabaret',
    subtitle: 'Musical Theatre — Sally Bowles',
    category: 'musical-theatre',
    year: 2024,
    venue: 'The Blue Room',
    city: 'Bengaluru',
    role: 'Sally Bowles',
    blurb: 'A ninety-seat black box where the audience sat at cabaret tables and became the Kit Kat Klub.',
    description:
      'An immersive staging where the venue was dressed as the club itself and the audience were treated as patrons throughout. The final number was performed with the house lights at full — no one applauded, which was the intention.',
    poster: poster('cabaret-the-blue-room'),
    gallery: [poster('cabaret-the-blue-room'), poster('hadestown-persephone')],
    runtime: '2h 10m',
    featured: true,
    accent: '#8b5cf6',
    credits: [
      { role: 'Sally Bowles', name: 'Sanjana' },
      { role: 'Director', name: 'Farah Sheikh' },
      { role: 'Band Leader', name: 'Ilya Novak' },
    ],
    tracks: [
      { id: 'cb-1', title: 'Maybe This Time', composer: 'Kander & Ebb', duration: 226 },
      { id: 'cb-2', title: 'Cabaret', composer: 'Kander & Ebb', duration: 288, note: 'House lights up.' },
    ],
  },
  {
    slug: 'les-mis-eponine',
    title: 'Les Misérables',
    subtitle: 'Musical Theatre — Éponine',
    category: 'musical-theatre',
    year: 2023,
    venue: 'National Centre Theatre',
    city: 'Mumbai',
    role: 'Éponine',
    blurb: 'The role that started everything — cast out of an open call three weeks before opening.',
    description:
      'A late replacement cast from an open audition, learning the role in nineteen days. "On My Own" was performed on a bare stage with a single follow spot, a staging kept from the original tech rehearsal because nothing better was found.',
    poster: poster('les-mis-eponine'),
    gallery: [poster('les-mis-eponine')],
    runtime: '2h 50m',
    accent: '#f0a23c',
    credits: [
      { role: 'Éponine', name: 'Sanjana' },
      { role: 'Director', name: 'Gabriel Ohene' },
      { role: 'Musical Director', name: 'Devika Rao' },
    ],
    tracks: [
      { id: 'lm-1', title: 'On My Own', composer: 'Schönberg & Boublil', duration: 249 },
      { id: 'lm-2', title: 'A Little Fall of Rain', composer: 'Schönberg & Boublil', duration: 187 },
    ],
  },
  {
    slug: 'into-the-woods-baker',
    title: 'Into the Woods',
    subtitle: 'Musical Theatre — The Baker’s Wife',
    category: 'musical-theatre',
    year: 2022,
    venue: 'Riverside Playhouse',
    city: 'Bengaluru',
    role: 'The Baker’s Wife',
    blurb: 'Sondheim at speed — the hardest ensemble singing on this whole site.',
    description:
      'A production staged with a nine-person cast doubling every role, meaning the Act One finale was sung by fewer than half the voices it was written for. The recording is from the closing matinee.',
    poster: poster('into-the-woods-baker'),
    gallery: [poster('into-the-woods-baker')],
    runtime: '2h 45m',
    accent: '#2fd6b8',
    credits: [
      { role: 'The Baker’s Wife', name: 'Sanjana' },
      { role: 'Director', name: 'Farah Sheikh' },
      { role: 'Musical Director', name: 'Leon Marsh' },
    ],
    tracks: [
      { id: 'iw-1', title: 'Moments in the Woods', composer: 'S. Sondheim', duration: 231 },
      { id: 'iw-2', title: 'It Takes Two', composer: 'S. Sondheim', duration: 204 },
    ],
  },

  {
    slug: 'neon-hymns-studio',
    title: 'Neon Hymns',
    subtitle: 'Studio Session — Debut EP',
    category: 'studio-session',
    year: 2025,
    venue: 'Glass House Studios',
    city: 'Mumbai',
    blurb: 'Five original songs cut over eleven days, mostly at night, mostly in one or two takes.',
    description:
      'The debut EP, tracked live to tape with the band in one room. The brief was that nothing would be comped — every vocal on the record is a single continuous performance, including the mistakes.',
    poster: poster('neon-hymns-studio'),
    gallery: [poster('neon-hymns-studio'), poster('glass-house-sessions'), poster('late-night-demo-tapes')],
    featured: true,
    accent: '#8b5cf6',
    credits: [
      { role: 'Vocals & Songwriting', name: 'Sanjana' },
      { role: 'Producer', name: 'Leon Marsh' },
      { role: 'Engineer', name: 'Aditi Bose' },
      { role: 'Mastering', name: 'North Room' },
    ],
    tracks: [
      { id: 'nh-1', title: 'Neon Hymn', composer: 'Sanjana', duration: 227, note: 'Take 2. The one on the record.' },
      { id: 'nh-2', title: 'Static Bloom', composer: 'Sanjana / L. Marsh', duration: 258 },
      { id: 'nh-3', title: 'Undertow', composer: 'Sanjana / D. Rao', duration: 294 },
      { id: 'nh-4', title: 'Kite String', composer: 'Sanjana', duration: 189 },
      { id: 'nh-5', title: 'Cathedral Glass', composer: 'Sanjana', duration: 331 },
    ],
  },
  {
    slug: 'glass-house-sessions',
    title: 'The Glass House Sessions',
    subtitle: 'Studio Session — Live to Tape',
    category: 'studio-session',
    year: 2024,
    venue: 'Glass House Studios',
    city: 'Mumbai',
    blurb: 'Four songs, four cameras, no overdubs — the session that became the calling card.',
    description:
      'A filmed live-to-tape session shot in a single afternoon. Everything was recorded simultaneously with the video, so what you see is what you hear. The session is the reason most of the work on this site happened.',
    poster: poster('glass-house-sessions'),
    gallery: [poster('glass-house-sessions'), poster('neon-hymns-studio')],
    accent: '#3f7dfb',
    credits: [
      { role: 'Vocals', name: 'Sanjana' },
      { role: 'Producer', name: 'Leon Marsh' },
      { role: 'Director of Photography', name: 'Maya Fernandes' },
    ],
    tracks: [
      { id: 'gh-1', title: 'Slow Burn (live to tape)', composer: 'Sanjana', duration: 271 },
      { id: 'gh-2', title: 'Seventeen Winters', composer: 'Sanjana', duration: 236 },
      { id: 'gh-3', title: 'Blue Hour', composer: 'Sanjana / I. Novak', duration: 305 },
    ],
  },
  {
    slug: 'first-light-single',
    title: 'First Light',
    subtitle: 'Studio Session — Single',
    category: 'studio-session',
    year: 2023,
    venue: 'North Room',
    city: 'Goa',
    blurb: 'The first release. Recorded in a converted garage over one weekend for almost no money.',
    description:
      'A debut single tracked in a garage with two microphones and a borrowed preamp. The demo was never re-recorded — the version that charted is the original weekend take with a slightly better master.',
    poster: poster('first-light-single'),
    gallery: [poster('first-light-single')],
    accent: '#9df3ff',
    credits: [
      { role: 'Vocals & Guitar', name: 'Sanjana' },
      { role: 'Engineer', name: 'Aditi Bose' },
    ],
    tracks: [
      { id: 'fl-1', title: 'First Light', composer: 'Sanjana', duration: 251 },
      { id: 'fl-2', title: 'First Light (demo)', composer: 'Sanjana', duration: 244, note: 'Phone recording, kept for the B-side.' },
    ],
  },
  {
    slug: 'late-night-demo-tapes',
    title: 'Late Night Demo Tapes',
    subtitle: 'Studio Session — Works in Progress',
    category: 'studio-session',
    year: 2025,
    venue: 'Home Setup',
    city: 'Mumbai',
    blurb: 'Unfinished songs, kept unfinished on purpose. Updated whenever something new survives the night.',
    description:
      'A rolling collection of voice-memo-grade demos recorded between other projects. None of these are mixed and most will never be finished, but a few have already made it onto records.',
    poster: poster('late-night-demo-tapes'),
    gallery: [poster('late-night-demo-tapes')],
    accent: '#7f9dbb',
    credits: [{ role: 'Everything', name: 'Sanjana' }],
    tracks: [
      { id: 'ld-1', title: 'Sketch — Nine Lives', composer: 'Sanjana', duration: 143, note: 'Unfinished. Verse only.' },
      { id: 'ld-2', title: 'Sketch — Copper Wire', composer: 'Sanjana', duration: 176 },
      { id: 'ld-3', title: 'Sketch — Tin Roof', composer: 'Sanjana', duration: 121 },
    ],
  },

  {
    slug: 'velvet-room-jazz-standards',
    title: 'The Velvet Room',
    subtitle: 'Collaboration — Standards Night',
    category: 'collaboration',
    year: 2024,
    venue: 'The Velvet Room',
    city: 'Kolkata',
    blurb: 'A monthly standards residency with a trio that had never played together before the first night.',
    description:
      'A residency built entirely on standards, with a rotating trio and no rehearsal. Every set was called from the stage, which means no two nights of the residency share a setlist.',
    poster: poster('velvet-room-jazz-standards'),
    gallery: [poster('velvet-room-jazz-standards'), poster('chicago-roxie-hart')],
    runtime: '2 × 45 min sets',
    accent: '#f0568f',
    credits: [
      { role: 'Vocals', name: 'Sanjana' },
      { role: 'Piano', name: 'Devika Rao' },
      { role: 'Double Bass', name: 'Tomas Vidal' },
      { role: 'Brushes', name: 'Rhea Kapoor' },
    ],
    tracks: [
      { id: 'vr-1', title: 'Autumn Leaves', composer: 'Kosma / Mercer', duration: 356 },
      { id: 'vr-2', title: 'I Fall in Love Too Easily', composer: 'Styne / Cahn', duration: 289 },
      { id: 'vr-3', title: 'Caravan', composer: 'Ellington / Tizol', duration: 412, note: 'Called from the stage.' },
    ],
  },
]

export const PERFORMANCE_MAP = Object.fromEntries(
  PERFORMANCES.map((p) => [p.slug, p]),
) as Record<string, Performance>
