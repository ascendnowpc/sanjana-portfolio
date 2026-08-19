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
    id: 'studio-session',
    label: 'Studio Sessions',
    blurb: 'Original writing, session vocals, and the takes that made the record.',
    accent: '#8b5cf6',
  },
  {
    id: 'collaboration',
    label: 'Collaborations',
    blurb: 'Guest features, ensembles, and one-night-only rooms.',
    accent: '#f0568f',
  },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<Category['id'], Category>
