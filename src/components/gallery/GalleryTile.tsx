import { memo, useEffect, useRef } from 'react'
import type { TileLayout } from './layout'
import { LoopingPreview } from '@/components/media/LoopingPreview'
import { mediaUrl } from '@/lib/media'

/**
 * How much a frame grows while it is being read.
 *
 * Exported because the gallery has to place the caption clear of the frame at
 * the size it will settle at, not the size it had when the cursor stopped.
 */
export const HOVER_SCALE = 1.14

interface Props {
  tile: TileLayout
  /** Populated by the gallery so its rAF loop can write transforms directly. */
  register: (key: string, refs: TileRefs | null) => void
  active: boolean
  /** The gallery hands a decoder to the nearest few tiles; this is one. */
  playing: boolean
  onSelect: (tile: TileLayout, el: HTMLElement) => void
}

export interface TileRefs {
  root: HTMLDivElement
  /** One overlay carrying both depth shading and the dim-the-rest state. */
  shade: HTMLDivElement
  tile: TileLayout
  /** Written by the gallery loop each frame: 0 = far side of the shell,
   *  1 = closest to the eye. Hit-testing and the decoder budget both rank on
   *  it, and it drives z-index so the nearest frame paints on top. */
  depth: number
  /** True while the tile is behind the viewer and taken out of the layout. */
  hidden?: boolean
  /** 0..1, eased by the loop: how much this is *the* frame being read. Drives
   *  the shading, so gaining and losing focus are both movements. */
  lit?: number
  /**
   * The tile's projected box in viewport px, written by the loop every frame
   * from the same arithmetic that produces the transform.
   *
   * This is what replaced measuring the DOM. Hover resolution and the decoder
   * budget both need to know where each frame landed, and both used to ask
   * `getBoundingClientRect` for it — eighty calls that each had to flush the
   * transforms written a moment earlier, twenty times a second. The projection
   * is rectilinear and exact, so the box can simply be computed instead.
   */
  left?: number
  right?: number
  top?: number
  bottom?: number
  /** Last values the loop wrote for the properties that change slowly, so it
   *  can skip the write when nothing moved. Owned entirely by the loop. */
  lastZ?: number
  lastAlpha?: number
  lastShade?: number
  lastTransform?: string
}

/**
 * One frame on the wall.
 *
 * Kept deliberately thin: eighty of these composite every frame, so anything
 * that only matters on hover (the gradient wash, the caption) is mounted only
 * while hovered, and the per-frame values — transform, opacity, shading — are
 * written by the gallery's loop through the registered refs rather than by
 * re-rendering.
 */
function GalleryTileBase({ tile, register, active, playing, onSelect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const shadeRef = useRef<HTMLDivElement>(null)
  const p = tile.performance
  const preview = p.previewSrc ?? p.videoSrc
  // Hovering always earns footage even if the tile missed the ambient cut.
  const showVideo = Boolean(preview) && (playing || active)

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
        // The margins put the tile's own centre exactly on the viewport
        // centre, so every tile's perspective() shares one vanishing point —
        // the same convergence a single ancestor perspective gives, without
        // needing preserve-3d (which Chromium cannot hit-test into).
        //
        // Centre, not the top edge. Anchoring at the top made the wall
        // top-heavy and it was not obvious why: a tile hangs *downward* from
        // its anchor, so one hung above the ceiling still drapes into view
        // while one hung below the floor falls out of frame entirely. The
        // asymmetry showed up as measured band coverage of 1.6/1.9/1.4 across
        // the top half against 0.45/0.20/0.16 across the bottom — the room had
        // a floor of nothing. Hanging each frame by its middle makes the
        // elevation it was given the elevation it actually reads at.
        marginTop: -tile.width / tile.aspect / 2,
        transformOrigin: '50% 50%',
      }}
    >
      <button
        type="button"
        aria-label={`${p.title} — ${p.subtitle}`}
        tabIndex={-1}
        onClick={(e) => onSelect(tile, e.currentTarget)}
        className="group relative block w-full cursor-pointer overflow-hidden bg-ink outline outline-white/5"
        style={{
          aspectRatio: tile.aspect,
          transition: 'transform 620ms var(--ease-out-expo), box-shadow 500ms',
          // Bigger than it was. The frame being read has to separate from a
          // wall of its neighbours, and now that no frame is 470px wide to
          // begin with there is room for it to grow into.
          transform: active ? `scale(${HOVER_SCALE})` : 'scale(1)',
          // Colourless. Each category used to tint its own hover — amber for
          // theatre, pink for duets, violet, green — so hovering across the
          // wall flashed through a paintbox. The reference lifts a frame with
          // nothing but its own picture and a plain light edge, and that is
          // what makes a hover there feel clean.
          boxShadow: active
            ? '0 0 0 1px rgba(232,226,214,0.42), 0 40px 110px -20px rgba(0,0,0,0.95)'
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
            // Was 5s, which is longer than most hovers last: letting go of a
            // frame left its picture creeping back for another four seconds
            // over a wall that had moved on, and a dozen of those overlapping
            // is a fair share of what read as glitching.
            transition: 'transform 1600ms var(--ease-out-expo), filter 600ms',
            // Runs under the preview loop, and carries the hover on its own
            // for any entry with no footage attached yet.
            transform: active ? 'scale(1.06)' : 'scale(1.01)',
            // No saturate/contrast boost on hover: the reference shows the
            // footage as it is, and pushing colour was part of what read as
            // "strange colours".
            filter: undefined,
          }}
        />

        {/* Always the short silent loop, never the full recording: a dozen of
            these run at once, and pointing them at four-minute files would
            pull hundreds of megabytes through the wall. Falls back to
            `videoSrc` for any entry with no preview cut yet. */}
        {showVideo && (
          <LoopingPreview src={mediaUrl(preview)!} poster={mediaUrl(p.poster)} />
        )}

        {/* Depth shading and the dim-everything-else state share one layer;
            its opacity is driven per-frame by the gallery loop. Compositing an
            overlay is far cheaper than animating a CSS filter. */}
        <div
          ref={shadeRef}
          className="pointer-events-none absolute inset-0 bg-void"
          style={{ opacity: 0.6 }}
        />

        {/* The invitation, on the picture itself.

            It used to sit with the title in the middle of the screen, several
            hundred pixels from the frame it referred to, which is a caption
            for a wall rather than for a picture. Here it is unambiguous: this
            frame, the lit one, opens. Mounted only while hovered — a text node
            per tile is cheap, but eighty of them are not. */}
        {active && (
          <>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.1) 42%, transparent 70%)',
                animation: 'tile-caption 420ms var(--ease-out-expo) both',
              }}
            />
            <span
              className="tracked on-scrim pointer-events-none absolute inset-x-0 bottom-[8%] text-center text-chalk"
              style={{
                fontSize: 'clamp(0.5rem, 0.72vw, 0.72rem)',
                animation: 'tile-caption 520ms var(--ease-out-expo) both',
              }}
            >
              Learn more
            </span>
          </>
        )}
      </button>
    </div>
  )
}

export const GalleryTile = memo(GalleryTileBase)
