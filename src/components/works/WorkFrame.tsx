import { memo } from 'react'
import type { Performance } from '@/types/content'
import { mediaUrl } from '@/lib/media'

interface Props {
  piece: Performance
  /** Some other row is under the pointer, so this frame is not in the lit one. */
  dimmed: boolean
  /** Above the fold on first paint, so its still is worth fetching eagerly. */
  eager?: boolean
  onEnter: (slug: string) => void
  onOpen: (piece: Performance, el: HTMLElement) => void
}

/**
 * One frame in a band: a still, and nothing else.
 *
 * Landscape, four across, cut edge to edge — the reference's shape, and the
 * reason the crop needs thinking about: half this archive is phone footage at
 * 9:16, and the middle horizontal slice of a portrait frame is a torso and a
 * mic stand. Portrait sources are therefore pulled up so the crop lands on
 * the face; landscape ones are already framed and stay centred.
 *
 * Everything the hover does happens above this component. The frame does not
 * play, scale, caption itself or draw an edge — three separate attempts at
 * hover state have been stripped out of it, and each one was the same mistake:
 * treating the tile as the thing that responds. In the reference the response
 * is the *page*, and the tile's only job is to be the part of it that stays
 * lit. A frame that also moved, or lit its own border, would be announcing
 * itself a second time in a quieter voice.
 *
 * Keyboard focus is the one exception, and it is not handled here either: the
 * global `:focus-visible` rule draws a white outline on this button, which is
 * the affordance a pointer gets from the dimming and a keyboard cannot.
 */
export const WorkFrame = memo(function WorkFrame({
  piece,
  dimmed,
  eager,
  onEnter,
  onOpen,
}: Props) {
  return (
    <button
      type="button"
      onMouseEnter={() => onEnter(piece.slug)}
      onFocus={() => onEnter(piece.slug)}
      onClick={(e) => onOpen(piece, e.currentTarget)}
      aria-label={`${piece.title} — ${piece.year}`}
      className="relative block aspect-video w-full cursor-pointer overflow-hidden bg-ink"
      style={{
        opacity: dimmed ? 0.08 : 1,
        transition: 'opacity 500ms ease-out',
      }}
    >
      <img
        src={mediaUrl(piece.poster)}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover"
        style={{
          objectPosition: (piece.aspect ?? 16 / 9) < 1 ? '50% 28%' : '50% 50%',
        }}
      />
    </button>
  )
})
