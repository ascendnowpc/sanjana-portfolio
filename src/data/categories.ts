import type { Category } from '@/types/content'

export const CATEGORIES: Category[] = [
  {
    id: 'solo-concert',
    label: 'Solo Concerts',
    blurb: 'Full-length headline sets — voice, band, and a room holding its breath.',
    accent: '#4fd8e8',
  },
  {
    id: 'musical-theatre',
    label: 'Musical Theatre',
    blurb: 'Book roles and staged work, from black-box cabaret to full proscenium.',
    accent: '#f0a23c',
  },
  {
    id: 'classical-repertoire',
    label: 'Classical Repertoire',
    blurb: 'Art song, aria and the trained-voice repertoire.',
    accent: '#7f9dbb',
  },
  {
    id: 'hindi-singing',
    label: 'Hindi Singing',
    blurb: 'Playback, ghazal and film repertoire.',
    accent: '#2fd6b8',
  },
  {
    id: 'honor-choir',
    label: 'Honor Choir',
    blurb: 'Selected ensemble work — one voice inside many.',
    accent: '#3f7dfb',
  },
  {
    id: 'collaboration',
    label: 'Duet/Group Performances',
    blurb: 'Duets, ensembles and one-night-only rooms.',
    accent: '#f0568f',
  },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<Category['id'], Category>
