import { useRef, useState } from 'react'
import type { Performance } from '@/types/content'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { WorkFrame } from '@/components/works/WorkFrame'

interface Props {
  pieces: readonly Performance[]
  /** The slug under the pointer anywhere on the page, or null. */
  hovered: string | null
  /** This is the first band on the page, so its first row is above the fold. */
  first: boolean
  onEnter: (slug: string) => void
  onLeave: () => void
  onOpen: (piece: Performance, el: HTMLElement) => void
}

/**
 * How many frames are across at this width.
 *
 * The grid's own `sm:` / `xl:` column classes are the source of truth for the
 * layout; this reads the same two breakpoints back out so the code can know
 * which frames ended up on a line together. The alternative — measuring the
 * rendered grid — is more honest and costs a layout read on every resize to
 * learn something the stylesheet already knows.
 */
function useColumns() {
  const xl = useMediaQuery('(min-width: 1280px)')
  const sm = useMediaQuery('(min-width: 640px)')
  return xl ? 4 : sm ? 3 : 2
}

/**
 * One category's frames.
 *
 * Two things happen here that cannot happen inside a tile, because both are
 * about the *row* rather than the frame the pointer is on.
 *
 * The first is what lights. Pointing at one frame lights the whole line it
 * sits on and drops every other line to a twentieth — the reference's own
 * behaviour, where a row is one piece in four stills and lighting only the
 * still under the cursor would tear the piece into quarters. Ours is four
 * performances to a row, so this is a looser reading than the reference
 * gets to make; it is still the right one to copy, because what the gesture
 * communicates is *here is the band of the page you are reading*, and a single
 * lit tile in a dark row communicates something narrower and fussier.
 *
 * The second is the word. It rides the cursor rather than sitting in the
 * middle of a tile — in the reference it is plainly a pointer label, tracking
 * across the stills as you sweep the row, not a caption pinned to any one of
 * them. It is moved by writing `transform` straight onto the node rather than
 * through state, so a mousemove does not re-render eleven frames to move one
 * word.
 */
export function WorkBand({
  pieces,
  hovered,
  first,
  onEnter,
  onLeave,
  onOpen,
}: Props) {
  const cols = useColumns()
  const label = useRef<HTMLSpanElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const [showLabel, setShowLabel] = useState(false)

  const index = hovered ? pieces.findIndex((p) => p.slug === hovered) : -1
  // -1 when the pointer is on another band, which dims this one whole.
  const litRow = index < 0 ? -1 : Math.floor(index / cols)

  return (
    <div
      ref={grid}
      className="relative grid grid-cols-2 gap-x-[3px] gap-y-4 sm:grid-cols-3 md:gap-y-6 xl:grid-cols-4"
      onMouseMove={(e) => {
        const box = grid.current?.getBoundingClientRect()
        const el = label.current
        if (!box || !el) return
        el.style.transform = `translate3d(${e.clientX - box.left}px, ${
          e.clientY - box.top
        }px, 0) translate(-50%, -50%)`
        // Deferred to the first move rather than set on enter, so the word
        // never appears for a frame at the last position it held.
        if (!showLabel) setShowLabel(true)
      }}
      // Leaving the band is what clears the hover — the gaps belong to the
      // band, so crossing one on the way to the next frame never flickers the
      // page back to full brightness.
      onMouseLeave={() => {
        setShowLabel(false)
        onLeave()
      }}
    >
      {pieces.map((p, i) => (
        <WorkFrame
          key={p.slug}
          piece={p}
          dimmed={hovered !== null && Math.floor(i / cols) !== litRow}
          eager={first && i < cols}
          onEnter={onEnter}
          onOpen={onOpen}
        />
      ))}

      <span
        ref={label}
        aria-hidden
        className="mono-label pointer-events-none absolute top-0 left-0 z-10 text-[0.5625rem] text-white md:text-[0.625rem]"
        style={{
          // A shadow rather than a plate: the word has to stay legible over
          // whatever frame it is crossing — a stage lit white as readily as a
          // blackout — and a chip would drag a rectangle across the picture.
          textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)',
          opacity: showLabel && litRow >= 0 ? 1 : 0,
          transition: 'opacity 220ms ease-out',
        }}
      >
        Discover
      </span>
    </div>
  )
}
