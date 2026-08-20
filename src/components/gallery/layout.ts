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
  minWidth: number
  maxWidth: number
}

/** The ratio tile widths are normalised against, and the fallback aspect. */
const LANDSCAPE = 16 / 9

const TAU = Math.PI * 2

/** Golden angle — even bearings with no repeating figure. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export const DEFAULT_CLOUD: CloudOptions = {
  /**
   * Two copies, deliberately spread half a turn apart.
   *
   * Enough frames that a look in any direction finds work, few enough that the
   * gaps stay as wide as the reference's — about twenty on screen at once, not
   * forty. Copies of one performance sit 180° apart so two of the same picture
   * can never be in view together.
   */
  repeats: 2,
  /**
   * The shell has thickness: some frames hang close and read large, others sit
   * well back. Now that nothing travels, this is the only depth cue left, so
   * the range is generous. Sized against the short focal length in
   * ImmersiveGallery — scale is focal ÷ distance, so a wide lens wants the
   * work closer or everything shrinks.
   */
  minRadius: 620,
  maxRadius: 1700,
  /**
   * Kept narrow on purpose. At ±0.28rad the highest and lowest frames land
   * near the top and bottom edges of a 16:9 viewport; wider than that and work
   * hangs permanently out of sight above the ceiling.
   */
  elevationSpread: 0.28,
  /**
   * Measured off the reference at a 1456px viewport: frames run about 40–290px
   * with most near the bottom of that range. These are pre-projection widths,
   * so the perspective scale of focal-length ÷ distance moves them around it.
   */
  minWidth: 70,
  maxWidth: 300,
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

      // Stratified rather than random: each tile gets its own slice of the
      // band and jitters within it, which fills the height evenly instead of
      // clumping frames at the horizon and leaving the top empty.
      const slice = (idx % n) / n
      const elevation =
        (slice * 2 - 1 + (rnd() - 0.5) * (1.6 / n)) * o.elevationSpread

      // Squared, so more frames sit far than near. An even spread of radii
      // puts too many large tiles in view at once and the shell feels
      // crowded; leaning far keeps a few frames forward as accents.
      const far = rnd()
      const radius = o.minRadius + (o.maxRadius - o.minRadius) * (1 - far * far)

      // Tiles are cut to the footage's own ratio rather than a uniform 16:9,
      // so portrait phone video is not centre-cropped into a letterbox strip.
      // Widths are then normalised to equal *area*, not equal width: a 9:16
      // tile drawn at full width would stand nearly twice as tall as its
      // landscape neighbours and wreck the density of the shell.
      const aspect = performance.aspect ?? LANDSCAPE
      const r = rnd()
      const base =
        o.minWidth +
        (o.maxWidth - o.minWidth) *
          (performance.featured ? 0.62 + rnd() * 0.38 : r * r)

      tiles.push({
        performance,
        key: `${performance.slug}-${rep}`,
        azimuth,
        elevation,
        radius,
        width: base * Math.sqrt(aspect / LANDSCAPE),
        aspect,
        phase: rnd() * TAU,
      })
    })
  }

  return tiles
}
