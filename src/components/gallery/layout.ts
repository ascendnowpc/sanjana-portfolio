import { seededRandom, hashString } from '@/lib/utils'
import type { Performance } from '@/types/content'

export interface TileLayout {
  performance: Performance
  /** Stable key — the same performance appears at several depths. */
  key: string
  /** Position on the wall, in px, relative to the viewport centre. Fixed:
   *  the wall travels forward and pans, it does not rotate. */
  x: number
  y: number
  /** Resting depth before travel is applied. */
  z: number
  /** Tile width in px; height derives from `aspect`. */
  width: number
  /** width / height the tile is cut to — the footage's own ratio. */
  aspect: number
  /** Small per-tile rotation so the wall never looks like a spreadsheet. */
  tilt: number
  /** Phase offset for the idle float, so tiles don't bob in unison. */
  phase: number
}

export interface CloudOptions {
  /** How many copies of the catalogue to stack down the tunnel. */
  repeats: number
  /** Total depth of one repeat, in px. */
  depth: number
  /** Radius of the clear hole in the middle, so the overlay copy stays legible. */
  innerRadius: number
  outerRadius: number
  minWidth: number
  maxWidth: number
}

/** The ratio tile widths are normalised against, and the fallback aspect. */
const LANDSCAPE = 16 / 9

/** Flattens the ring into a wide wall rather than a sphere. */
const VERTICAL_SQUASH = 0.58

/**
 * Angular slots the tiles are allowed to occupy.
 *
 * This is the whole difference between a corridor and a snowstorm. Tiles are
 * pinned to a fixed set of directions out from the centre, so flying forward
 * you pass between standing columns of work rather than through scattered
 * confetti. Coprime with SHELLS and with the stride below, so every
 * (slot, shell) pair gets used before any repeats.
 */
const SLOTS = 13

/**
 * Concentric distances from the axis. Three depths of wall, so the corridor
 * has thickness without losing the alignment that SLOTS buys.
 */
const SHELLS = 3

/**
 * How far to step around the ring between consecutive pieces.
 *
 * Coprime with SLOTS, so consecutive work lands on opposite sides of the
 * corridor and the eye is never handed two neighbours at once.
 */
const SLOT_STRIDE = 5

/** Jitter, as a fraction of the slot/shell spacing. Enough to break the
 *  machine-made look, small enough that the columns still read as columns. */
const ANGLE_JITTER = 0.055
const RADIUS_JITTER = 0.06

export const DEFAULT_CLOUD: CloudOptions = {
  repeats: 3,
  depth: 3200,
  // The vertical squash pulls the top and bottom slots toward the middle, so
  // the hole has to be cut wider than the copy block looks: at 340 the tiles
  // in those two slots were landing on the headline.
  innerRadius: 440,
  outerRadius: 1180,
  minWidth: 250,
  // No single tile should dominate the frame. Depth is what makes something
  // big here; a 560px tile arriving at the camera just swamped the copy.
  maxWidth: 480,
}

/**
 * Hangs the catalogue on a corridor wall.
 *
 * Previously this scattered tiles by golden angle at random radii, which
 * spreads them evenly but leaves no structure at all — the wall read as noise,
 * and every tile arriving at a random depth with a random tilt made it read as
 * busy rather than deep.
 *
 * Now each piece is pinned to one of SLOTS directions out from the axis and
 * one of SHELLS distances along it, and the depths are evenly spaced rather
 * than random. The result is a lattice: columns of work standing in the dark
 * that you fly between, arriving at a steady rhythm. A little jitter keeps it
 * from looking machine-made, and the centre is left empty so the hero copy
 * always sits on darkness.
 */
export function buildCloud(
  performances: Performance[],
  opts: Partial<CloudOptions> = {},
): TileLayout[] {
  const o = { ...DEFAULT_CLOUD, ...opts }
  if (!performances.length) return []

  const tiles: TileLayout[] = []
  const slotArc = (Math.PI * 2) / SLOTS
  // Shells are spaced by area rather than by radius: equal radial steps put
  // far more tiles per unit of screen on the outer shell, which is what made
  // the old sqrt-weighted radius necessary in the first place.
  const shellStep = (o.outerRadius - o.innerRadius) / Math.max(1, SHELLS - 1)

  for (let rep = 0; rep < o.repeats; rep++) {
    performances.forEach((performance, i) => {
      const idx = rep * performances.length + i
      const rnd = seededRandom(hashString(performance.slug) + rep * 7919)

      // Half a slot of offset per repeat, so a piece does not sit in the same
      // column every time the catalogue comes round again.
      const slot = (idx * SLOT_STRIDE) % SLOTS
      const angle = (slot + rep * 0.5) * slotArc + (rnd() - 0.5) * slotArc * ANGLE_JITTER

      const shell = (idx + rep) % SHELLS
      const radius =
        (o.innerRadius + shell * shellStep) *
        (1 + (rnd() - 0.5) * RADIUS_JITTER)

      // Evenly spaced down the tunnel — a steady rhythm of arrivals. The
      // shell offset staggers the three walls against each other so they do
      // not reach the camera as one flat curtain.
      const slotZ = (i + (shell / SHELLS) * 0.6) / performances.length
      // Featured work sits a little nearer the front of each repeat.
      const lead = performance.featured ? -0.22 : 0
      const z = -(rep * o.depth + (slotZ + lead) * o.depth)

      // Tiles are cut to the footage's own ratio rather than a uniform 16:9,
      // so portrait phone video is not centre-cropped into a letterbox strip.
      // Widths are then normalised to equal *area*, not equal width: a 9:16
      // tile drawn at full width would stand nearly twice as tall as its
      // landscape neighbours and wreck the density of the wall.
      const aspect = performance.aspect ?? LANDSCAPE
      // Narrower spread than before. Wildly mixed sizes read as clutter; a
      // calm range lets the depth do the work of making things big or small.
      const base =
        o.minWidth +
        (o.maxWidth - o.minWidth) *
          (performance.featured ? 0.72 + rnd() * 0.28 : 0.34 + rnd() * 0.3)

      tiles.push({
        performance,
        key: `${performance.slug}-${rep}`,
        x: Math.cos(angle) * radius,
        // Flattened vertically — a wide wall reads better than a sphere.
        y: Math.sin(angle) * radius * VERTICAL_SQUASH,
        z,
        width: base * Math.sqrt(aspect / LANDSCAPE),
        aspect,
        // Flat against the wall. The old ±2.5deg of roll was the single
        // biggest source of visual noise: thirty rectangles at thirty
        // different angles never resolves into a structure.
        tilt: 0,
        phase: rnd() * Math.PI * 2,
      })
    })
  }

  return tiles
}
