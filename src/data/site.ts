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
