import { useEffect, useRef, useState } from 'react'
import { useMediaQuery, usePrefersReducedMotion } from '@/hooks/useMediaQuery'

/**
 * The lattice's period. Lines every half of it, so a dot layer tiled at the
 * full period lands on every other crossing — which is how the reference
 * spaces its dots, and why one modulo keeps all three layers in step.
 */
const TILE = 256
const CELL = TILE / 2

/** The lit patch is a square this wide; the mask's radius is half of it. */
const PATCH = 720

/** How fast the light catches up with the pointer, per 60fps frame. */
const EASE = 0.24

/**
 * The light itself: opaque at the pointer, gone by the edge of the square.
 * `closest-side` rather than a length so the falloff is tied to `PATCH` and
 * the two can never drift apart — a mask wider than its box is a hard circular
 * cut, which is the one thing this must not look like.
 */
const SPOT =
  'radial-gradient(circle closest-side, rgba(0,0,0,1) 0%, ' +
  'rgba(0,0,0,0.86) 30%, rgba(0,0,0,0.38) 62%, rgba(0,0,0,0) 100%)'

const mod = (n: number, m: number) => ((n % m) + m) % m

interface Props {
  /**
   * Whether the page is idle — nothing under the pointer, nothing dimmed.
   *
   * The archive has two moods and they must not overlap. Pointing at a piece
   * drops every other frame to a twelfth of its opacity, and a frame at a
   * twelfth is no longer a lid: the grid would come up *through* the covers,
   * which is precisely what it is not allowed to do. So the light is only lit
   * while the page is at full brightness, which is exactly when the pointer is
   * over nothing.
   */
  idle: boolean
}

/**
 * The grid the pointer finds in the empty parts of the archive.
 *
 * A faint lattice — hairlines every 128px, a dot on every other crossing —
 * that exists only inside a soft circle around the cursor, taken from the
 * reference's ground. It is off the page everywhere else, which is the whole
 * gesture: the emptiness between the bands stops being nothing and becomes a
 * surface, but only where you are looking.
 *
 * It never draws over a cover, and not by testing what is under the pointer.
 * The layer sits at `z-0` beneath the archive's own `z-10`, so every frame is
 * simply a lid over it; the only places it can reach daylight are the ones
 * where the page has nothing on it. Hit-testing would have got the same answer
 * most of the time and been wrong at every edge.
 *
 * The patch is a fixed 720px square rather than a full-screen sheet with a
 * moving mask. Both look identical; this one repaints a fifth of the area on a
 * large display, because the light travels on `transform`. The pattern inside
 * it is slid back by exactly what the square travels, so the lines stay welded
 * to the page while the light moves across them — including as the archive
 * scrolls, which is why `scrollY` goes into the same sum.
 */
export function CursorGrid({ idle }: Props) {
  const patch = useRef<HTMLDivElement>(null)
  // A pointer that can hover, and a reader who has not asked for stillness.
  // On a touch screen there is no cursor for this to sit under, and the whole
  // effect is a thing that follows one.
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
  const reduced = usePrefersReducedMotion()
  // The one piece of this that React is told about: whether the pointer is in
  // the window at all. Everything else is written straight onto the node —
  // moving a light must not re-render an archive.
  const [inside, setInside] = useState(false)

  useEffect(() => {
    const el = patch.current
    if (!el || !fine || reduced) return

    const to = { x: 0, y: 0 }
    // Negative until the pointer has been seen once, so the light is never
    // eased in from the corner of the screen on the first move.
    const at = { x: -1, y: -1 }
    let raf = 0
    let last = 0
    let bg = ''
    let shown = false

    const write = () => {
      const left = Math.round(at.x) - PATCH / 2
      const top = Math.round(at.y) - PATCH / 2
      el.style.transform = `translate3d(${left}px, ${top}px, 0)`
      const next = `${mod(-left, TILE)}px ${mod(-top - window.scrollY, TILE)}px`
      // Guarded because this is the one write that costs a repaint, and a
      // sideways sweep of under a pixel does not move the lattice.
      if (next !== bg) {
        bg = next
        el.style.backgroundPosition = next
      }
    }

    const step = (t: number) => {
      // Framerate-normalised, or the light trails twice as far behind on a
      // 60Hz display as on a 120Hz one. Clamped so a backgrounded tab does not
      // return with a single frame worth several seconds of catch-up.
      const f = Math.min(4, (t - last) / 16.667)
      last = t
      const k = 1 - Math.pow(1 - EASE, f)
      at.x += (to.x - at.x) * k
      at.y += (to.y - at.y) * k
      if (Math.abs(to.x - at.x) < 0.4 && Math.abs(to.y - at.y) < 0.4) {
        at.x = to.x
        at.y = to.y
        write()
        raf = 0
        return
      }
      write()
      raf = requestAnimationFrame(step)
    }

    const kick = () => {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(step)
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      to.x = e.clientX
      to.y = e.clientY
      if (at.x < 0) {
        at.x = to.x
        at.y = to.y
        // Placed before the fade begins, so the first sighting cannot show a
        // frame of light sitting at the top left corner.
        write()
      }
      if (!shown) {
        shown = true
        setInside(true)
      }
      kick()
    }

    const leave = () => {
      shown = false
      setInside(false)
    }

    // Scrolling moves the page under a stationary pointer, and the lattice is
    // the page's, not the window's. No easing to run for it — the light has
    // not moved, only what is written inside it.
    const onScroll = () => {
      if (at.x >= 0) write()
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('pointerleave', leave)
    }
  }, [fine, reduced])

  if (!fine || reduced) return null

  return (
    <div
      ref={patch}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-0"
      style={{
        width: PATCH,
        height: PATCH,
        // Faint on purpose. On flat black a hairline at 0.145 lands around
        // #252525 — enough to read as ruled paper under raking light, not
        // enough to become a second thing on a page whose content is
        // photographs. The dots carry three times that because a 2px mark
        // needs it to be seen at all.
        backgroundImage: [
          'radial-gradient(circle, rgba(255,255,255,0.44) 1px, transparent 1.7px)',
          'linear-gradient(to right, rgba(255,255,255,0.145) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgba(255,255,255,0.145) 1px, transparent 1px)',
        ].join(','),
        backgroundSize: `${TILE}px ${TILE}px, ${CELL}px ${CELL}px, ${CELL}px ${CELL}px`,
        maskImage: SPOT,
        WebkitMaskImage: SPOT,
        opacity: idle && inside ? 1 : 0,
        // Long enough that crossing a cover reads as the light passing behind
        // it rather than as a switch being thrown.
        transition: 'opacity 420ms ease-out',
        willChange: 'transform',
      }}
    />
  )
}
