import { memo } from 'react'
import type { Performance } from '@/types/content'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

interface Props {
  piece: Performance
  /** The one frame under the pointer. */
  active: boolean
  /** Some *other* frame is under the pointer. */
  dimmed: boolean
  /** Above the fold on first paint, so its still is worth fetching eagerly. */
  eager?: boolean
  onEnter: (slug: string) => void
  onOpen: (piece: Performance, el: HTMLElement) => void
}

/**
 * One frame in a band.
 *
 * Landscape, four across, cut edge to edge — the reference's shape, and the
 * reason the crop needs thinking about: half this archive is phone footage at
 * 9:16, and the middle horizontal slice of a portrait frame is a torso and a
 * mic stand. Portrait sources are therefore pulled up so the crop lands on
 * the face; landscape ones are already framed and stay centred.
 *
 * The frame is a **still**, at rest and on hover alike. It used to swap in the
 * looping preview under the pointer, and that read as the picture going soft:
 * the loop is cut at 480px for the gallery wall, where a dozen play at once
 * and decode is the constraint, and blown up to a quarter of a wide screen it
 * is visibly softer than the poster it replaced. The poster is a frame off the
 * full transcode, so leaving it up is both sharper and cheaper. Hover is
 * carried by what is around it instead — the rest of the page drops away, the
 * still eases in, the name arrives.
 */
export const WorkFrame = memo(function WorkFrame({
  piece,
  active,
  dimmed,
  eager,
  onEnter,
  onOpen,
}: Props) {
  const reduced = usePrefersReducedMotion()
  const poster = mediaUrl(piece.poster)
  const objectPosition = (piece.aspect ?? 16 / 9) < 1 ? '50% 28%' : '50% 50%'

  return (
    <button
      type="button"
      onMouseEnter={() => onEnter(piece.slug)}
      onFocus={() => onEnter(piece.slug)}
      onClick={(e) => onOpen(piece, e.currentTarget)}
      aria-label={`${piece.title} — ${piece.year}`}
      className="group relative block aspect-video w-full cursor-pointer overflow-hidden bg-ink"
      style={{
        opacity: dimmed ? 0.18 : 1,
        transition: 'opacity 500ms ease-out',
      }}
    >
      <img
        src={poster}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover"
        style={{
          objectPosition,
          transform: active && !reduced ? 'scale(1.045)' : 'scale(1)',
          transition: 'transform 1200ms var(--ease-out-expo)',
        }}
      />

      {/* Mounted with the hover rather than faded from opacity-0: the frames
          carry no titles at rest — that is the whole look — so this is the
          only place the name appears, and it should arrive with the picture
          rather than sit there invisible on thirty-six frames at once. */}
      {active && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 md:p-4"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.22) 48%, transparent 78%)',
            animation: 'tile-caption 420ms var(--ease-out-expo) both',
          }}
        >
          <span className="mono-label min-w-0 truncate text-[0.5625rem] text-white md:text-[0.625rem]">
            {piece.title}
          </span>
          <span className="mono-label shrink-0 text-[0.5625rem] text-white/60 md:text-[0.625rem]">
            {piece.year}
          </span>
        </div>
      )}

      {/* A drawn edge, not a glow — the same hairline the index wall uses. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.34)' : 'none',
          transition: 'box-shadow 400ms',
        }}
      />
    </button>
  )
})
