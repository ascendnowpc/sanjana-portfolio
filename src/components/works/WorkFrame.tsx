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
 * full transcode, so leaving it up is both sharper and cheaper.
 *
 * Hover is therefore carried entirely by what is *around* the picture, which
 * is how the reference does it: the rest of the page falls to a seventh of
 * its opacity and a single word arrives in the middle of the one frame left
 * lit. Nothing moves and nothing scales — the reference's stills are dead
 * still under the pointer, and against a page that has just gone dark the
 * absence of motion is what makes the lit frame read as the subject rather
 * than as an animation playing.
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
        opacity: dimmed ? 0.14 : 1,
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
        style={{ objectPosition }}
      />

      {/* The one word, centred, exactly as the reference has it — mounted
          with the hover rather than faded from opacity-0, because the frames
          carry no lettering at rest and thirty-six invisible labels are
          thirty-six nodes to composite for nothing.

          It replaced a title-and-year caption along the bottom edge under its
          own gradient. That was more informative and it was the wrong shape:
          a band of gradient at the foot of the one bright frame on a dark
          page reads as a second, softer edge, and the eye goes to it instead
          of the picture. The name is a click away on the detail page, and the
          list view carries all thirty-six of them in full. */}
      {active && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={
            reduced
              ? undefined
              : { animation: 'tile-caption 420ms var(--ease-out-expo) both' }
          }
        >
          <span
            className="mono-label text-[0.5625rem] text-white md:text-[0.625rem]"
            // A shadow rather than a plate or a scrim: the label has to sit on
            // whatever frame it lands on — a stage lit white as readily as a
            // blackout — and this is the only treatment that survives both
            // without laying a rectangle over the picture.
            style={{ textShadow: '0 1px 12px rgba(0,0,0,0.85)' }}
          >
            Discover
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
