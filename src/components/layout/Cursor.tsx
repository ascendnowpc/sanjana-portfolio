import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

/**
 * The pointer, redrawn.
 *
 * Three parts moving at different rates read as one object with weight: a dot
 * pinned to the true position, a ring trailing behind it, and a label that
 * only appears when the ring has something to say. The ring also stretches
 * along its direction of travel, which is what sells the lag as momentum
 * rather than as latency.
 *
 * Everything is written straight to `style` from one rAF loop — no React state
 * per frame — and the writes are skipped entirely once the pointer has settled,
 * so an idle cursor costs nothing while the gallery is animating behind it.
 *
 * Suppressed on touch devices and under reduced motion, where a lagging
 * ornament is worse than the real cursor.
 */

/** How hard the ring stretches along its travel. */
const STRETCH = 0.01
/** Ring diameter, in px — the geometry the scales below are relative to. */
const RING = 18

type Mode = 'idle' | 'link' | 'tile' | 'native'

/**
 * Ring scale and label for each thing the pointer can be over.
 *
 * Deliberately restrained. An earlier pass ran an 80px ring over the gallery
 * tiles, which stopped reading as a pointer and started reading as a hole in
 * the artwork — at that size it hid the very frame it was pointing at.
 */
const MODES: Record<Mode, { scale: number; fill: number; label: string }> = {
  idle: { scale: 1, fill: 0, label: '' },
  link: { scale: 1.5, fill: 0.07, label: '' },
  tile: { scale: 2.2, fill: 0.1, label: 'View' },
  // Native controls and text fields: the real cursor is better than anything
  // drawn here, so the ring gets out of the way entirely.
  native: { scale: 1, fill: 0, label: '' },
}

export function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return

    const ring = ringRef.current
    const dot = dotRef.current
    const label = labelRef.current
    if (!ring || !dot || !label) return

    const target = { x: innerWidth / 2, y: innerHeight / 2 }
    const slow = { ...target }
    const fast = { ...target }
    /** Smoothed velocity of the ring, for the stretch. */
    const vel = { x: 0, y: 0 }

    let mode: Mode = 'idle'
    /** Eased ring scale — the mode switch is a jump, the ring is not. */
    let scale = 1
    let down = false
    let inside = false
    let raf = 0
    /** Set whenever something changed; cleared once the frame has drawn it. */
    let dirty = true

    const root = document.documentElement

    const resolve = (el: EventTarget | null): Mode => {
      if (!(el instanceof Element)) return 'idle'
      // A video's controls live in shadow DOM and cannot be aimed at with a
      // ring that lags the pointer — scrubbing a timeline you cannot see is
      // guesswork. Hand the real cursor back over them.
      if (
        el.closest(
          'video[controls], input:not([type=range]), textarea, [contenteditable]',
        )
      )
        return 'native'
      if (el.closest('[data-tile]')) return 'tile'
      if (el.closest('a, button, [role="slider"], label, select, summary'))
        return 'link'
      return 'idle'
    }

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      inside = true
      const next = resolve(e.target)
      if (next !== mode) {
        mode = next
        label.textContent = MODES[mode].label
      }
      dirty = true
    }

    const onDown = () => {
      down = true
      dirty = true
    }
    const onUp = () => {
      down = false
      dirty = true
    }
    const onLeave = () => {
      inside = false
      dirty = true
    }
    const onEnter = () => {
      inside = true
      dirty = true
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)

      const dx = target.x - slow.x
      const dy = target.y - slow.y
      const m = MODES[mode]
      const want = m.scale * (down ? 0.86 : 1)
      // Once the ring has caught up and finished resizing there is nothing to
      // draw, so the loop idles instead of writing the same transforms over
      // the top of the gallery's own work every frame.
      if (
        !dirty &&
        Math.abs(dx) < 0.05 &&
        Math.abs(dy) < 0.05 &&
        Math.abs(want - scale) < 0.002
      )
        return

      slow.x += dx * 0.16
      slow.y += dy * 0.16
      fast.x += (target.x - fast.x) * 0.55
      fast.y += (target.y - fast.y) * 0.55

      vel.x += (dx * 0.16 - vel.x) * 0.2
      vel.y += (dy * 0.16 - vel.y) * 0.2

      scale += (want - scale) * 0.18
      const hidden = !inside || mode === 'native'
      const speed = Math.hypot(vel.x, vel.y)

      // Stretch along the direction of travel and pinch across it, so the ring
      // reads as being dragged through the frame rather than lagging it. It is
      // damped as the ring grows: a big ring smearing looks like a bug.
      const s = Math.min(speed * STRETCH, 0.5) / scale
      const angle = (Math.atan2(vel.y, vel.x) * 180) / Math.PI

      ring.style.transform =
        `translate3d(${slow.x}px, ${slow.y}px, 0) translate(-50%,-50%) ` +
        `rotate(${angle}deg) scale(${scale * (1 + s)}, ${scale * (1 - s * 0.6)}) ` +
        `rotate(${-angle}deg)`
      ring.style.opacity = hidden ? '0' : '1'
      ring.style.backgroundColor = `rgba(79,216,232,${m.fill})`
      ring.style.borderColor =
        mode === 'idle' ? 'rgba(142,166,192,0.5)' : 'rgba(79,216,232,0.75)'

      // The label rides the ring but must not inherit its stretch, or the
      // type shears — so it is positioned separately at the same point.
      label.style.transform =
        `translate3d(${slow.x}px, ${slow.y}px, 0) translate(-50%,-50%)`
      label.style.opacity = !hidden && m.label ? '1' : '0'

      dot.style.transform =
        `translate3d(${fast.x}px, ${fast.y}px, 0) translate(-50%,-50%) ` +
        `scale(${down ? 2 : 1})`
      // The dot would sit inside the label once the ring is captioned, so it
      // steps aside there and lets the word carry the state on its own.
      dot.style.opacity = hidden || m.label ? '0' : '1'

      dirty = false
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    document.addEventListener('pointerenter', onEnter)
    raf = requestAnimationFrame(frame)
    // A class, not an inline style: every interactive element in the site
    // carries `cursor-pointer`, which outranks an inline `cursor:none` on
    // <html> and put the arrow back over precisely the tiles and links the
    // ring exists to react to.
    root.classList.add('cursor-none')

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('pointerenter', onEnter)
      cancelAnimationFrame(raf)
      root.classList.remove('cursor-none')
    }
  }, [reduced])

  if (reduced) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] hidden md:block">
      <div
        ref={ringRef}
        className="absolute rounded-full border will-change-transform"
        style={{
          height: RING,
          width: RING,
          borderColor: 'rgba(142,166,192,0.45)',
          opacity: 0,
          // No backdrop-filter here, tempting as it is: a blurred backdrop on
          // an element that floats over eighty composited tiles forces a
          // readback of the whole wall behind it every single frame.
          boxShadow: '0 0 14px rgba(79,216,232,0.12)',
          transition:
            'border-color 320ms var(--ease-out-expo), background-color 320ms var(--ease-out-expo), opacity 260ms',
        }}
      />
      <span
        ref={labelRef}
        className="absolute font-medium text-halo uppercase"
        style={{
          opacity: 0,
          fontSize: '0.4rem',
          letterSpacing: '0.18em',
          transition: 'opacity 260ms var(--ease-out-expo)',
        }}
      />
      <div
        ref={dotRef}
        className="absolute h-[4px] w-[4px] rounded-full bg-bloom will-change-transform"
        style={{ opacity: 0, transition: 'opacity 220ms' }}
      />
    </div>
  )
}
