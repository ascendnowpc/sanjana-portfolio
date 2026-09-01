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
 * An entry that is not 4:5 is centre-cropped to fit, so a 16:9 still loses a
 * good deal of both sides.
 *
 * A category with no entry here falls back to the poster of its most recent
 * piece, so adding a discipline never means editing this file.
 */
export const MUSIC_COVERS: Partial<Record<CategoryId, string>> = {
  'solo-concert': '/media/covers/solo-concert-4x5.jpg',
  'musical-theatre': '/media/covers/musical-theatre-4x5.jpg',
  'hindi-singing': '/media/covers/hindi-singing-4x5.jpg',
  'honor-choir': '/media/covers/honor-choir-4x5.jpg',
  'collaboration': '/media/posters/collaboration-2025-07.jpg',
  'classical-repertoire': '/media/covers/classical-repertoire-4x5.jpg',
}
