import type { SiteProfile } from '@/types/content'

/** PLACEHOLDER COPY — swap for Sanjana's real bio, links and portraits. */
export const PROFILE: SiteProfile = {
  name: 'SANJANA',
  role: 'Vocalist',
  tagline: 'Solo concerts, musical theatre, and the takes that made the record.',
  bioShort:
    'A performer who works in rooms rather than genres — arena, black box, chapel, garage.',
  bio: [
    'Sanjana is a vocalist and performer working across solo concert repertoire, musical theatre and original studio writing. Her work tends to be defined less by genre than by the room it happens in: a four-thousand-seat arena and a ninety-seat black box ask for completely different instruments, and she treats them that way.',
    'Trained classically before moving into theatre, she was cast as Éponine out of an open call three weeks before opening — a run that led to Sally Bowles, Roxie Hart and Persephone across the following four seasons. Alongside the stage work she writes and records her own material, most of it tracked live with no comping.',
    'Recent work includes the Midnight Bloom arena run, a one-night orchestral commission rescoring six original songs for fifty-two players, and the debut EP Neon Hymns — cut over eleven nights with every vocal kept as a single continuous take.',
  ],
  basedIn: 'Mumbai, India — touring internationally',
  vocalRange: 'Mezzo-soprano · F3 – E6',
  training: [
    'Hindustani classical — 9 years',
    'Musical theatre performance, Royal Conservatory',
    'Estill Voice Training, Level 2',
    'Sight-singing & ensemble, City Symphony Chorus',
  ],
  portraits: [
    '/media/portraits/portrait-1.jpg',
    '/media/portraits/portrait-2.jpg',
    '/media/portraits/portrait-3.jpg',
    '/media/portraits/portrait-4.jpg',
    '/media/portraits/portrait-5.jpg',
    '/media/portraits/portrait-6.jpg',
  ],
  press: [
    {
      quote:
        'She sings the way a room sounds after everyone has stopped talking — you lean in without deciding to.',
      source: 'The Evening Review',
    },
    {
      quote:
        'The most disciplined Sally Bowles this city has seen in a decade, and by some distance the saddest.',
      source: 'Stage & Signal',
    },
    {
      quote: 'Neon Hymns is a debut with nothing hidden behind the mix. Rare, and slightly terrifying.',
      source: 'Long Player Quarterly',
    },
  ],
  stats: [
    { value: '40+', label: 'Solo concerts' },
    { value: '11', label: 'Theatre productions' },
    { value: '4', label: 'Records & EPs' },
    { value: '9k', label: 'Largest room' },
  ],
  contact: {
    email: 'hello@sanjana.example',
    booking: 'booking@sanjana.example',
    instagram: 'https://instagram.com/',
    youtube: 'https://youtube.com/',
    spotify: 'https://open.spotify.com/',
  },
}

/**
 * The beats that run down the left of the About page's portrait section,
 * beside the model.
 *
 * PLACEHOLDER COPY — swap for Sanjana's real bio. Written to the same brief
 * as `PROFILE.bio` above and against the same invented credits, so the two
 * agree with each other; neither is a source of fact.
 *
 * Kept as headed beats rather than as prose because the column is read at
 * scroll speed against something moving beside it. A reader who looks up at
 * the model and back down needs a line to land on, and a paragraph does not
 * give them one. The last word of each heading is set in reverse on the page
 * — the copy carries the split so the emphasis is written, not guessed at by
 * a regex over the string.
 */
export interface PortraitBeat {
  /** Small caps heading, all but its final word. */
  heading: string
  /** The final word, which the page reverses out. */
  accent: string
  body: string
}

export const PORTRAIT_BEATS: PortraitBeat[] = [
  {
    heading: 'Trained before',
    accent: 'taught',
    body: 'Nine years of Hindustani classical before a single stage, then musical theatre performance at the Royal Conservatory on top of it. The two do not blend so much as argue, and most of what her voice does now comes out of that argument — ornament held against line, weight held against carry.',
  },
  {
    heading: 'The room picks the',
    accent: 'voice',
    body: 'A four-thousand-seat arena and a ninety-seat black box are different instruments, and she treats them that way. The arena take is built to survive a delay tower; the black box take is built to be overheard. Neither is the other one scaled up or down.',
  },
  {
    heading: 'Recorded',
    accent: 'live',
    body: 'Neon Hymns was cut over eleven nights with the band in the room and every vocal kept as one continuous take. Nothing was comped and nothing was tuned. What is on the record is what happened on the night it was played.',
  },
]
