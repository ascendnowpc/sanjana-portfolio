import { seededRandom, hashString } from '@/lib/utils'
import type { Performance } from '@/types/content'

export interface TileLayout {
  performance: Performance
  /** Stable key — the same performance appears at several depths. */
  key: string
  /** Position on the cylinder wall, in px, relative to the viewport centre. */
  x: number
  y: number
  /** Resting depth before travel is applied. */
  z: number
  /** Tile width in px; height derives from the 16:9 poster. */
  width: number
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

export const DEFAULT_CLOUD: CloudOptions = {
  repeats: 3,
  depth: 3200,
  innerRadius: 300,
  outerRadius: 1180,
  minWidth: 250,
  maxWidth: 560,
}

/**
 * Distributes performances through a cylindrical shell of 3D space.
 *
 * Golden-angle placement spreads tiles evenly around the ring without any
 * visible row/column structure, and the sqrt-weighted radius keeps density
 * even instead of clumping toward the middle. The centre is kept empty so the
 * hero copy always sits on darkness.
 */
export function buildCloud(
  performances: Performance[],
  opts: Partial<CloudOptions> = {},
): TileLayout[] {
  const o = { ...DEFAULT_CLOUD, ...opts }
  if (!performances.length) return []

  const GOLDEN = Math.PI * (3 - Math.sqrt(5))
  const tiles: TileLayout[] = []

  for (let rep = 0; rep < o.repeats; rep++) {
    performances.forEach((performance, i) => {
      const idx = rep * performances.length + i
      const rnd = seededRandom(hashString(performance.slug) + rep * 7919)

      const angle = idx * GOLDEN + rep * 0.6
      // sqrt keeps the ring evenly dense rather than crowding the inner edge.
      const radius =
        o.innerRadius + (o.outerRadius - o.innerRadius) * Math.sqrt(rnd())

      // Featured work sits nearer the front of each repeat so it reads first.
      const slot = (i + (performance.featured ? -0.35 : 0.15)) / performances.length
      const z = -(rep * o.depth + slot * o.depth + (rnd() - 0.5) * 380)

      tiles.push({
        performance,
        key: `${performance.slug}-${rep}`,
        x: Math.cos(angle) * radius,
        // Flattened vertically — a wide wall reads better than a sphere.
        y: Math.sin(angle) * radius * 0.58,
        z,
        width:
          o.minWidth +
          (o.maxWidth - o.minWidth) * (performance.featured ? 0.6 + rnd() * 0.4 : rnd()),
        tilt: (rnd() - 0.5) * 5,
        phase: rnd() * Math.PI * 2,
      })
    })
  }

  return tiles
}
