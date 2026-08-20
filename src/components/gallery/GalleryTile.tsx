import { memo, useEffect, useRef, useState } from 'react'
import type { TileLayout } from './layout'
import { mediaUrl } from '@/lib/media'

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
  /** Last values the loop wrote for the properties that change slowly, so it
   *  can skip the write when nothing moved. Owned entirely by the loop. */
  lastZ?: number
  lastAlpha?: number
  lastShade?: number
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
          aspectRatio: tile.aspect,
          transition: 'transform 700ms var(--ease-out-expo), box-shadow 500ms',
          transform: active ? 'scale(1.045)' : 'scale(1)',
          // Colourless. Each category used to tint its own hover — amber for
          // theatre, pink for duets, violet, green — so hovering across the
          // wall flashed through a paintbox. The reference lifts a frame with
          // nothing but its own picture and a plain light edge, and that is
          // what makes a hover there feel clean.
          boxShadow: active
            ? '0 0 0 1px rgba(232,226,214,0.34), 0 30px 90px -24px rgba(0,0,0,0.9)'
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
            // Runs under the preview loop, and carries the hover on its own
            // for any entry with no footage attached yet.
            transform: active ? 'scale(1.14)' : 'scale(1.01)',
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
        {showVideo && <TilePreview src={mediaUrl(preview)!} />}

        {/* Depth shading and the dim-everything-else state share one layer;
            its opacity is driven per-frame by the gallery loop. Compositing an
            overlay is far cheaper than animating a CSS filter. */}
        <div
          ref={shadeRef}
          className="pointer-events-none absolute inset-0 bg-void"
          style={{ opacity: 0.6 }}
        />

      </button>
    </div>
  )
}

/**
 * The looping preview on one tile, mounted only while it holds a decoder.
 *
 * Split out of the tile so the element's whole life — start, first frame,
 * release — happens in one effect. The previous version drove it from an
 * inline `ref` callback, which React tears down and re-runs on every render
 * of the tile, so `play()` fired repeatedly and raced its own promise.
 *
 * It stays transparent until a frame is actually decoded. The poster sits
 * directly underneath, so what the viewer sees is a still that quietly starts
 * moving, never a black rectangle punched into the wall.
 */
function TilePreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  // The source is attached here rather than as a `src` prop, because the
  // teardown below detaches it and React would not know to put it back: it
  // still believes the attribute holds the value it rendered. Under
  // StrictMode, which runs every effect twice, that left every preview
  // pointing at nothing.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.src = src
    // A clip already in the HTTP cache can reach HAVE_CURRENT_DATA before the
    // `loadeddata` listener would have anything to report, which would leave
    // the preview running behind a transparent element forever.
    if (el.readyState >= 2) setReady(true)
    // Safari declines the autoplay attribute more readily than Chrome even
    // when muted, so ask explicitly. A rejection here is not an error worth
    // surfacing: the poster is already the fallback.
    void el.play().catch(() => {})
    return () => {
      // Dropping the node is not enough to hand the decoder back promptly —
      // the element can sit in the media pool still holding it, which is
      // exactly the resource the budget upstream exists to ration.
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
  }, [src])

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      style={{
        opacity: ready ? 1 : 0,
        transition: 'opacity 600ms var(--ease-out-expo)',
      }}
      onLoadedData={() => setReady(true)}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
    />
  )
}

export const GalleryTile = memo(GalleryTileBase)
