import type { CategoryId } from '@/types/content'

/**
 * Cover art for the listening cards in the About page's music shelf.
 *
 * This is the only hand-picked thing in that section. Everything else — the
 * song titles, their order, their durations, which card they belong to — is
 * read straight out of the performance archive, so a card is never out of
 * step with the work it collects.
 *
 * Each entry defaults to a still already in the repo, so the shelf is never
 * broken while the real art is being chosen. To swap one in: drop the image
 * at `public/media/covers/<category>.jpg`, point the entry at
 * `/media/covers/<category>.jpg`, and it is live — the same key resolves to
 * the R2 bucket in production (see MEDIA.md). Any absolute https:// URL also
 * works untouched.
 *
 * **Square art.** The card crops its cover to 1:1, so a 16:9 still loses its
 * top and bottom. Solo Concerts and Musical Theatre are 4:5 posters, so rather
 * than crop them the files are already square: each poster is centred on a
 * black field the width of the frame, which reads as no border at all because
 * the posters' own edges are black. Any art that must survive whole wants the
 * same treatment. The remaining entries are 16:9 stills and are cropped.
 *
 * A category with no entry here falls back to the poster of its most recent
 * piece, so adding a discipline never means editing this file.
 */
export const MUSIC_COVERS: Partial<Record<CategoryId, string>> = {
  'solo-concert': '/media/covers/solo-concert-poster.jpg',
  'musical-theatre': '/media/covers/musical-theatre-poster.jpg',
  'hindi-singing': '/media/posters/hindi-singing-2025-01.jpg',
  'honor-choir': '/media/posters/honor-choir-2025-02.jpg',
  'collaboration': '/media/posters/collaboration-2025-07.jpg',
  'classical-repertoire': '/media/posters/classical-repertoire-2023-01.jpg',
}
