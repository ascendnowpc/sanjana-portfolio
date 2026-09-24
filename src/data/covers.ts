import type { MusicalCover } from '@/types/content'

/**
 * The covers shelf on the About page.
 *
 * Empty in the deploy, and deliberately so. A cover is a real recording of a
 * real song, and there is no honest placeholder for one — a card invented here
 * would put a song she has not sung on the page. The shelf's second key
 * therefore does not appear to a visitor until there is something behind it;
 * in edit mode it is always there, so the first cover can be added from the
 * page itself (see `CoversShelf`).
 *
 * Filling it: sign in, open the covers key on About, and add one. Dropping a
 * video on the card writes `videoSrc`, `audioSrc` and `duration` in one go —
 * the soundtrack is lifted off the film in the browser rather than typed in
 * (see lib/videoPipeline.ts). Everything here can equally be typed by hand in
 * the panel's Covers tab, or committed straight into this file.
 *
 * Covers that were part of a staged performance belong in the archive
 * instead — see `PERFORMANCES`. This is for the ones that exist on their own.
 */
export const COVERS: MusicalCover[] = []
