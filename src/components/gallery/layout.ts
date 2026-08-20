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
 * Placement is scattered, not gridded.
 *
 * An earlier pass pinned tiles to thirteen fixed angular slots on three
 * shells, on the theory that the reference wall was a corridor of standing
 * columns. Watching it actually move says otherwise: the tiles are strewn
 * through the volume at every angle and every distance from the axis, and the
 * regularity I thought I saw in stills was just perspective lining things up
 * for a moment. Golden-angle placement gives that — even coverage with no
 * repeating figure — which is what was here originally.
 */
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * How much of the radius is random rather than evenly stepped.
 *
 * Fully random clumps; fully even reads as a target. Stepping the radius and
 * then jittering it keeps the field even at any depth without banding.
 */
const RADIUS_JITTER = 0.42

/** Depth scatter as a fraction of the gap between consecutive tiles. Tiles
 *  must not arrive at the camera in evenly spaced ranks. */
const DEPTH_JITTER = 0.85

export const DEFAULT_CLOUD: CloudOptions = {
  repeats: 3,
  /**
   * Spacing, not density.
   *
   * The last pass packed this to 2350 chasing "more frames on screen" and the
   * result was a mosaic — tiles touching, no black between them, nothing for
   * the eye to rest on. In the reference the gaps are as considered as the
   * frames: roughly two thirds of the screen is empty at any moment.
   */
  depth: 3400,
  /**
   * A soft clearing in the middle rather than a cut hole.
   *
   * 440 made a donut; 90 let tiles sit on the wordmark. The reference keeps a
   * loose gap around its centre copy that work still drifts near but rarely
   * through.
   */
  innerRadius: 210,
  // Wide enough that the corners of the frame are never empty.
  outerRadius: 1500,
  /**
   * Small. This is the single biggest correction.
   *
   * Ours ran 200–560px against a 1456px viewport, so two or three tiles could
   * own the whole frame and everything read as clutter. Measured off the
   * reference at the same viewport width the range is roughly 40–290, with
   * most frames nearer the bottom of it — the wall is made of many modest
   * pictures and a few large ones, not the other way round.
   */
  minWidth: 96,
  maxWidth: 360,
}

/**
 * Scatters the catalogue through the volume of the tunnel.
 *
 * Golden-angle placement spreads tiles evenly around the axis without any
 * repeating figure, and the radius is stepped-then-jittered so the field stays
 * evenly dense from the middle out rather than clumping.
 *
 * The two things that matter most are what is *not* here. Nothing is held back
 * from the centre, so far tiles converge to a vanishing point and the wall
 * reads as a volume you are inside rather than a ring you are passing through.
 * And no tile carries any roll: watching the reference move, every frame is
 * square to the world and the only rotation is the perspective turning it
 * toward the axis. Random roll was the single biggest source of visual noise
 * when this had it.
 */
export function buildCloud(
  performances: Performance[],
  opts: Partial<CloudOptions> = {},
): TileLayout[] {
  const o = { ...DEFAULT_CLOUD, ...opts }
  if (!performances.length) return []

  const tiles: TileLayout[] = []
  for (let rep = 0; rep < o.repeats; rep++) {
    performances.forEach((performance, i) => {
      const idx = rep * performances.length + i
      const rnd = seededRandom(hashString(performance.slug) + rep * 7919)

      const angle = idx * GOLDEN

      // Stepped through the full range as the index advances, then jittered.
      // sqrt on the stepped part keeps the density even: without it, equal
      // radial steps crowd the middle, because a ring's area grows with r.
      const even = Math.sqrt(((idx * 0.618) % 1))
      const spread = even * (1 - RADIUS_JITTER) + rnd() * RADIUS_JITTER
      const radius = o.innerRadius + (o.outerRadius - o.innerRadius) * spread

      // Evenly spaced down the tunnel, then scattered by most of one gap, so
      // work does not arrive at the camera in ranks.
      const slot = (i + (rnd() - 0.5) * DEPTH_JITTER) / performances.length
      // Featured work sits a little nearer the front of each repeat.
      const lead = performance.featured ? -0.22 : 0
      const z = -(rep * o.depth + (slot + lead) * o.depth)

      // Tiles are cut to the footage's own ratio rather than a uniform 16:9,
      // so portrait phone video is not centre-cropped into a letterbox strip.
      // Widths are then normalised to equal *area*, not equal width: a 9:16
      // tile drawn at full width would stand nearly twice as tall as its
      // landscape neighbours and wreck the density of the wall.
      const aspect = performance.aspect ?? LANDSCAPE
      // A wide spread of sizes, on purpose. The reference has small frames
      // deep in the middle and slabs at the edges in the same view, and that
      // mixture is a large part of why it reads as depth rather than as a
      // pattern.
      // Squared, so the distribution leans small: many modest frames and the
      // occasional large one, which is what the reference's range looks like
      // when you measure it. A flat random gives far too many mid-size tiles
      // and the wall turns into a patchwork.
      const r = rnd()
      const base =
        o.minWidth +
        (o.maxWidth - o.minWidth) *
          (performance.featured ? 0.6 + rnd() * 0.4 : r * r)

      tiles.push({
        performance,
        key: `${performance.slug}-${rep}`,
        x: Math.cos(angle) * radius,
        // Flattened vertically — a wide wall reads better than a sphere.
        y: Math.sin(angle) * radius * VERTICAL_SQUASH,
        z,
        width: base * Math.sqrt(aspect / LANDSCAPE),
        aspect,
        tilt: 0,
        phase: rnd() * Math.PI * 2,
      })
    })
  }
  return tiles
}
