import type { CategoryId } from '@/types/content'

/**
 * Cover art for the listening cards in the About page's music shelf.
 *
 * This is the only hand-picked thing in that section. Everything else — the
 * song titles, their order, their durations, which card they belong to — is
 * read straight out of the performance archive, so a card is never out of
 * step with the work it collects.
 *
 * All six disciplines now have real art. To add or replace one: drop the image
 * at `public/media/covers/<category>-4x5.jpg`, point the entry at
 * `/media/covers/<category>-4x5.jpg`, and it is live — the same key resolves
 * to the R2 bucket in production (see MEDIA.md). Any absolute https:// URL
 * also works untouched.
 *
 * **The frame is 4:5, because the art is.** The posters are made at Instagram
 * portrait size, so the sleeve was set to match rather than the posters being
 * bent to fit a square. They go in at 1400x1750 exactly as exported — nothing
 * cropped, nothing padded, no decision to make per image.
 *
 * That is the whole rule, and it is worth keeping: the sleeve was square
 * first, and every poster then needed its own answer to the leftover width —
 * match the field, extend the edge, and a separate rule about not extending an
 * edge a figure runs off, because that smears. Changing one number in
 * AlbumCard deleted all of it. Export the next poster at 4:5 and there is
 * nothing to do.
 *
 * A category with no entry here still falls back to the poster of its most
 * recent piece, so adding a discipline never breaks the shelf — but those are
 * 16:9, and a 16:9 still centre-cropped into a 4:5 frame loses a good deal of
 * both sides. A new discipline wants a poster, not the fallback.
 */
export const MUSIC_COVERS: Partial<Record<CategoryId, string>> = {
  'solo-concert': '/media/covers/solo-concert-4x5-v2.jpg',
  'musical-theatre': '/media/covers/musical-theatre-4x5.jpg',
  'hindi-singing': '/media/covers/hindi-singing-4x5.jpg',
  'honor-choir': '/media/covers/honor-choir-4x5.jpg',
  'collaboration': '/media/covers/collaboration-4x5.jpg',
  'classical-repertoire': '/media/covers/classical-repertoire-4x5.jpg',
}

/**
 * The recording the index plays under itself — the first thing a visitor
 * hears, before they have read a word or opened a single piece.
 *
 * One entry, named by slug rather than by path, so it stays pinned to a real
 * performance in the archive: swapping the front page's sound means changing
 * this slug and nothing else. `from` / `to` cut an excerpt out of the take —
 * left open here, so the recording plays from its own beginning and stops
 * where it stops.
 */
export const HOUSE_CLIP = {
  slug: 'solo-concert-2025-10',
  from: 0,
  to: undefined as number | undefined,
}
