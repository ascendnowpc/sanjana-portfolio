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
 * The bio, as it is read down the left of the About page's portrait section.
 *
 * PLACEHOLDER COPY — swap for Sanjana's real bio. Written to the same brief as
 * `PROFILE.bio` above and against the same invented credits, so the two agree
 * with each other; neither is a source of fact. Every name, count and date
 * below is made up, which matters more here than anywhere else on the site,
 * because this is the part a reader will take as biography.
 *
 * Written as a life rather than as a pitch. It runs training, then the break,
 * then the record, then the range — which is the order the facts happened in
 * and, not by coincidence, the order that makes each beat explain the next.
 * The alternative is the shape most performer bios take, where four
 * paragraphs each claim the same thing in different adjectives.
 *
 * Headed beats rather than continuous prose, because the column is read at
 * scroll speed against something moving beside it. A reader who looks up at
 * the model and back down needs a line to land on, and a paragraph does not
 * give them one. The heads carry a fact apiece for the same reason — a
 * scanner who reads nothing else still comes away with four of them.
 */
export interface PortraitBeat {
  /** Small-caps heading, all but its final word. */
  heading: string
  /**
   * The final word, which the page reverses out.
   *
   * Split in the copy rather than found by a regex over the string, so the
   * emphasis is a thing somebody chose. It falls on the word carrying the
   * fact — `stage`, `opening`, `take` — never on a preposition that happened
   * to end the line.
   */
  accent: string
  body: string
}

export const PORTRAIT = {
  lead: 'Sanjana is a vocalist working across solo concert repertoire, musical theatre and her own records. What holds those together is not a genre. It is a way of using a room — she tunes to the space rather than to the monitor, and what you hear is what happened in it.',

  beats: [
    {
      heading: 'Nine years before a single',
      accent: 'stage',
      body: 'She started in Hindustani classical at seven and stayed with it for nine years, which is long enough for it to stop being lessons and start being the way you hear. Ornament, breath control, the habit of tuning to a room rather than to a monitor — none of it was chosen with a career in mind, and all of it is still the first thing she reaches for.',
    },
    {
      heading: 'Cast three weeks before',
      accent: 'opening',
      body: 'The Royal Conservatory taught her the other half: projection, text, how a lyric survives a second act. She was cast as Éponine out of an open call three weeks before opening night, and the four seasons that followed brought Sally Bowles, Roxie Hart and Persephone. Eleven productions, and not one of them sung the way the last one was.',
    },
    {
      heading: 'Every vocal in one',
      accent: 'take',
      body: 'Neon Hymns was cut over eleven nights with the band in the room. Nothing was comped and nothing was tuned, and every vocal on it is a single continuous pass — which is a decision you make once and then have to keep making at two in the morning.',
    },
    {
      heading: 'Ninety seats, then nine',
      accent: 'thousand',
      body: 'Forty solo concerts, a one-night orchestral commission that rescored six of her own songs for fifty-two players, and the Midnight Bloom arena run. She treats a four-thousand-seat room and a ninety-seat black box as different instruments, because they are: one take has to survive a delay tower, the other has to be worth overhearing.',
    },
  ] satisfies PortraitBeat[],
}
