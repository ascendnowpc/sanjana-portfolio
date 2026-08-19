import { memo, useEffect, useRef } from 'react'
import type { TileLayout } from './layout'
import { mediaUrl } from '@/lib/utils'
import { CATEGORY_MAP } from '@/data/categories'

interface Props {
  tile: TileLayout
  /** Populated by the gallery so its rAF loop can write transforms directly. */
  register: (key: string, refs: TileRefs | null) => void
  active: boolean
  onSelect: (tile: TileLayout, el: HTMLElement) => void
}

export interface TileRefs {
  root: HTMLDivElement
  /** One overlay carrying both depth shading and the dim-the-rest state. */
  shade: HTMLDivElement
  tile: TileLayout
  /** Written by the gallery loop each frame: 0 = far, 1 = at the camera.
   *  Hit-testing uses it to pick the frontmost tile under the pointer. */
  depth: number
}

/**
 * One frame on the wall.
 *
 * Kept deliberately thin: 30-odd of these composite every frame, so anything
 * that only matters on hover (the gradient wash, the caption) is mounted only
 * while hovered, and the per-frame values — transform, opacity, shading — are
 * written by the gallery's loop through the registered refs rather than by
 * re-rendering.
 */
function GalleryTileBase({ tile, register, active, onSelect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const shadeRef = useRef<HTMLDivElement>(null)
  const p = tile.performance
  const accent = p.accent ?? CATEGORY_MAP[p.category].accent

  // Registered once on mount; the gallery's rAF loop owns these nodes from
  // then on. Child refs are attached before the parent effect runs, so both
  // nodes are guaranteed present here.
  useEffect(() => {
    const root = rootRef.current
    const shade = shadeRef.current
    if (!root || !shade) return
    register(tile.key, { root, shade, tile, depth: 0 })
    return () => register(tile.key, null)
  }, [register, tile])

  return (
    <div
      ref={rootRef}
      data-tile={tile.key}
      className="absolute top-1/2 left-1/2 will-change-transform"
      style={{
        width: tile.width,
        marginLeft: -tile.width / 2,
        // top:50% + the negative margin put local (50%, 0) exactly on the
        // viewport centre, so every tile's perspective() shares one vanishing
        // point — the same convergence a single ancestor perspective gives,
        // without needing preserve-3d (which Chromium cannot hit-test into).
        transformOrigin: '50% 0',
      }}
    >
      <button
        type="button"
        aria-label={`${p.title} — ${p.subtitle}`}
        tabIndex={-1}
        onClick={(e) => onSelect(tile, e.currentTarget)}
        className="group relative block w-full cursor-pointer overflow-hidden bg-ink outline outline-white/5"
        style={{
          aspectRatio: '16 / 9',
          transition: 'transform 700ms var(--ease-out-expo), box-shadow 500ms',
          transform: active ? 'scale(1.045)' : 'scale(1)',
          boxShadow: active
            ? `0 0 0 1px ${accent}66, 0 30px 90px -20px ${accent}55`
            : 'none',
        }}
      >
        <img
          src={mediaUrl(p.poster)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
          style={{
            transition: 'transform 5s var(--ease-out-expo), filter 600ms',
            // Slow Ken Burns push stands in for the hover-preview video until
            // real footage is attached (see `videoSrc` in the content model).
            transform: active ? 'scale(1.14)' : 'scale(1.01)',
            // Filters force their own paint pass, so only the hovered tile
            // pays for one.
            filter: active ? 'saturate(1.15) contrast(1.05)' : undefined,
          }}
        />

        {p.videoSrc && active && (
          <video
            src={mediaUrl(p.videoSrc)}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
          />
        )}

        {/* Depth shading and the dim-everything-else state share one layer;
            its opacity is driven per-frame by the gallery loop. Compositing an
            overlay is far cheaper than animating a CSS filter. */}
        <div
          ref={shadeRef}
          className="pointer-events-none absolute inset-0 bg-void"
          style={{ opacity: 0.6 }}
        />

        {/* Hover wash — mounted only while focused, so the other ~30 tiles
            carry no extra layers. The title and year deliberately live in the
            centre overlay only: repeating them on the tile collides with that
            copy whenever the focused tile sits near the middle of the wall. */}
        {active && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${accent}38, transparent 60%)`,
            }}
          />
        )}
      </button>
    </div>
  )
}

export const GalleryTile = memo(GalleryTileBase)
