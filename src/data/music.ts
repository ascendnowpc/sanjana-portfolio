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
 * top and bottom. The four posters below are 4:5, so rather than crop them the
 * files are already square — the poster sits at full height and the extra width
 * is filled rather than taken out of the art. What to fill it with is decided
 * by what the poster has at its left and right edges:
 *
 * - A flat field: match it. Solo Concerts and Musical Theatre are black,
 *   Hindi Singing is #f23a29 red, and in each case the fill is invisible.
 * - Bands running off the side: extend the edge pixels outward, so they keep
 *   going. Classical Repertoire's film strips need this — a flat field would
 *   have cut all four dead at the seam.
 *
 * Do not extend an edge a *figure* runs off. Hindi Singing has two of them at
 * the bottom corners, and extending smeared them sideways into streaks; the
 * flat red leaves them cropped where the poster already cropped them, a few
 * pixels further in. Extension only reads as continuation for a band.
 *
 * Either way nothing is cropped. The remaining entries are 16:9 stills, and
 * those are cropped to their middle band.
 *
 * A category with no entry here falls back to the poster of its most recent
 * piece, so adding a discipline never means editing this file.
 */
export const MUSIC_COVERS: Partial<Record<CategoryId, string>> = {
  'solo-concert': '/media/covers/solo-concert-poster.jpg',
  'musical-theatre': '/media/covers/musical-theatre-poster.jpg',
  'hindi-singing': '/media/covers/hindi-singing-poster.jpg',
  'honor-choir': '/media/posters/honor-choir-2025-02.jpg',
  'collaboration': '/media/posters/collaboration-2025-07.jpg',
  'classical-repertoire': '/media/covers/classical-repertoire-poster.jpg',
}
