import type { Category } from '@/types/content'

export const CATEGORIES: Category[] = [
  {
    id: 'solo-concert',
    label: 'Solo Concerts',
    blurb: 'Full-length headline sets — voice, band, and a room holding its breath.',
    accent: '#e6e6e6',
  },
  {
    id: 'musical-theatre',
    label: 'Musical Theatre',
    blurb: 'Book roles and staged work, from black-box cabaret to full proscenium.',
    accent: '#cfcfcf',
  },
  {
    id: 'classical-repertoire',
    label: 'Classical Repertoire',
    blurb: 'Art song, aria and the trained-voice repertoire.',
    accent: '#b8b8b8',
  },
  {
    id: 'hindi-singing',
    label: 'Hindi Singing',
    blurb: 'Playback, ghazal and film repertoire.',
    accent: '#a1a1a1',
  },
  {
    id: 'honor-choir',
    label: 'Honor Choir',
    blurb: 'Selected ensemble work — one voice inside many.',
    accent: '#8a8a8a',
  },
  {
    id: 'collaboration',
    label: 'Duet/Group Performances',
    short: 'Duet / Group',
    blurb: 'Duets, ensembles and one-night-only rooms.',
    accent: '#d6d6d6',
  },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<Category['id'], Category>
