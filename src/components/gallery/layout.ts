import { seededRandom, hashString } from '@/lib/utils'
import type { Performance } from '@/types/content'

/**
 * A frame hanging in the shell of pictures around the viewer.
 *
 * Positions are *angles*, not coordinates. The viewer stands still at the
 * centre and turns; a tile's place in the world never changes, only the
 * direction you are facing. That is the whole model, and it is why there is no
 * `x`/`y`/`z` here any more — those belonged to a wall that flew past you.
 */
export interface TileLayout {
  performance: Performance
  /** Stable key — the same performance appears at several bearings. */
  key: string
  /** Bearing around the viewer, in radians. 0 is dead ahead at rest. */
  azimuth: number
  /** Angle above (+) or below (−) the horizon, in radians. */
  elevation: number
  /** Distance from the viewer, in px. Varies so the shell has thickness. */
  radius: number
  /** Tile width in px at unit scale; height derives from `aspect`. */
  width: number
  /** width / height the tile is cut to — the footage's own ratio. */
  aspect: number
  /** Phase offset for the idle float, so tiles don't bob in unison. */
  phase: number
}

export interface CloudOptions {
  /** How many copies of the catalogue to hang around the viewer. */
  repeats: number
  /** Nearest and furthest a tile may sit from the viewer. */
  minRadius: number
  maxRadius: number
  /** How far above and below the horizon tiles may hang, in radians. */
  elevationSpread: number
  /**
   * Focal length of the projection the tiles will be drawn under.
   *
   * Sizes below are given in the px they should occupy *on screen*, and the
   * width a tile is actually cut to is solved from that, so this has to be the
   * same focal length the gallery draws with. It is passed in rather than
   * duplicated.
   */
  focal: number
  /** On-screen width, in px, a tile should have when it is dead ahead. */
  minScreen: number
  maxScreen: number
}

/** The ratio tile widths are normalised against, and the fallback aspect. */
const LANDSCAPE = 16 / 9

const TAU = Math.PI * 2

/** Golden angle — even bearings with no repeating figure. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export const DEFAULT_CLOUD: CloudOptions = {
  /**
   * Three copies, spread evenly around the horizon.
   *
   * Density is the product of how many frames hang in the shell and how big
   * each one is on screen, and the sizes below just came down by a third — two
   * copies at the new size cover about a fifth of the viewport, which reads as
   * a nearly empty room. A third copy puts the coverage back where the
   * reference sits it without making any single frame bigger. Copies of one
   * performance sit a third of a turn apart, so the same still is never in
   * view twice.
   */
  repeats: 3,
  /**
   * The shell has thickness: some frames hang close and read large, others sit
   * well back. Since sizes below are given on screen and the cut width is
   * solved from the radius, this range now only controls parallax and shading
   * — how much the shell moves against itself as the viewer turns — and not
   * how big anything looks.
   */
  minRadius: 560,
  maxRadius: 1400,
  /**
   * Taller than the screen, on purpose.
   *
   * Screen height is 2·P·tan(θ), so at a 780px focal length a 840px viewport
   * covers ±0.49rad. Hanging work out to ±0.68 puts roughly a third of the
   * catalogue above the ceiling and below the floor at any moment, which is
   * what lets each frame be half again as big without the wall closing into a
   * single overlapping mat: about fourteen frames on screen instead of twenty.
   * The pitch the viewer can reach covers the difference, so nothing hung out
   * there is unreachable.
   */
  elevationSpread: 0.68,
  /** Matches PERSPECTIVE in ImmersiveGallery, which passes it in. */
  focal: 780,
  /**
   * On-screen width when dead ahead, which is the number that actually answers
   * Sneha's note that the frames are "very smallish".
   *
   * Given on screen rather than pre-projection because the two used to be
   * drawn independently — a width from one distribution, a radius from another
   * — and their extremes could coincide. The widest frame in the catalogue
   * landing at the nearest radius projected past three thousand pixels and
   * swallowed the viewport whole. Solving the cut width from the radius puts a
   * hard ceiling on what any one frame can do.
   *
   * Frames drift larger than these toward the edges of the screen, where the
   * shell swings closer to the eye — by about half again at the corners, which
   * is the perspective doing its job.
   *
   * Down by nearly half from 150/470. At the old ceiling a featured frame near the
   * edge of vision projected past 640px — nearly half the width of the screen
   * — and a frame that size stops reading as one picture among many hanging in
   * a room and starts reading as the page itself. The depth cues that sell the
   * shell are all comparative: a near frame only looks near next to a far one,
   * and there is no room left for a far one when the near one is that big.
   */
  minScreen: 98,
  maxScreen: 268,
}

/**
 * Hangs the catalogue in a shell around the viewer.
 *
 * Bearings come from the golden angle so coverage is even at any heading with
 * no repeating pattern; elevations are stratified across the band and then
 * jittered, so frames never line up into rows; radii spread across the shell's
 * thickness so some read near and some far.
 *
 * Nothing here is on a wall and nothing has a travel direction. Tiles are
 * placed once and never move again — the loop that draws them only ever
 * changes where the viewer is *looking*.
 */
export function buildCloud(
  performances: Performance[],
  opts: Partial<CloudOptions> = {},
): TileLayout[] {
  const o = { ...DEFAULT_CLOUD, ...opts }
  if (!performances.length) return []

  const tiles: TileLayout[] = []
  const n = performances.length

  for (let rep = 0; rep < o.repeats; rep++) {
    performances.forEach((performance, i) => {
      const idx = rep * n + i
      const rnd = seededRandom(hashString(performance.slug) + rep * 7919)

      // Golden angle spreads the catalogue evenly around the horizon; the
      // per-repeat offset guarantees a performance's copies sit as far apart
      // as the shell allows, so you never see the same still twice at once.
      const azimuth = (i * GOLDEN + (rep * TAU) / o.repeats) % TAU

      // Stratified across the whole set: each tile gets its own slice of the
      // band and jitters within it, so the height fills evenly and a
      // performance's two copies are half a band apart rather than at
      // identical heights.
      //
      // Monotonic in `idx`, and that is the load-bearing part. This was
      // `(idx · 0.618034) % 1`, which is uniform over the whole catalogue and
      // looks unimpeachable — but 0.618034 is 1 − 0.381966, and 0.381966 turns
      // is exactly the golden angle the bearings above step by. The two
      // sequences are the same sequence running backwards: elevation came out
      // a strict function of bearing, so the shell was a spiral ramp and not a
      // cloud. Sweeping 24 headings, the fraction of frames in view sitting
      // above the horizon ran from 0.00 to 1.00 — turn one way and the room
      // has no floor, turn the other and it has no ceiling. That is the empty
      // half of the screen.
      //
      // Pairing a golden-angle bearing with a monotonic elevation is the
      // Fibonacci lattice, and it is even at every heading: the same sweep
      // gives 0.44 to 0.56.
      const total = n * o.repeats
      const slice = (idx + 0.5) / total
      const elevation =
        (slice * 2 - 1 + (rnd() - 0.5) * (1.6 / total)) * o.elevationSpread

      // Even across the shell's thickness. It used to lean far, to stop too
      // many large tiles being in view at once — but size no longer follows
      // from distance, so all this decides now is how much a tile shifts
      // against its neighbours as the viewer turns, and an even spread gives
      // the fullest range of that.
      const radius = o.minRadius + (o.maxRadius - o.minRadius) * rnd()

      // Tiles are cut to the footage's own ratio rather than a uniform 16:9,
      // so portrait phone video is not centre-cropped into a letterbox strip.
      // Sizes are then normalised to equal *area*, not equal width: a 9:16
      // tile drawn at full width would stand nearly twice as tall as its
      // landscape neighbours and wreck the density of the shell.
      const aspect = performance.aspect ?? LANDSCAPE
      const r = rnd()
      const screen =
        o.minScreen +
        (o.maxScreen - o.minScreen) *
          (performance.featured ? 0.6 + rnd() * 0.4 : r * Math.sqrt(r))

      // Solve the cut width from the size it should project to at this radius.
      const width = (screen * radius) / o.focal

      tiles.push({
        performance,
        key: `${performance.slug}-${rep}`,
        azimuth,
        elevation,
        radius,
        width: width * Math.sqrt(aspect / LANDSCAPE),
        aspect,
        phase: rnd() * TAU,
      })
    })
  }

  return tiles
}
