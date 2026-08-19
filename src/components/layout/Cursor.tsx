import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

/**
 * A trailing ring that swells over anything interactive.
 *
 * Two elements at different lag values read as a single object with weight.
 * Suppressed entirely on touch devices and under reduced-motion.
 */
export function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return

    const ring = ringRef.current
    const dot = dotRef.current
    if (!ring || !dot) return

    const target = { x: innerWidth / 2, y: innerHeight / 2 }
    const slow = { ...target }
    const fast = { ...target }
    let over = false
    let raf = 0

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      const el = e.target as HTMLElement
      over = Boolean(
        el.closest('a, button, [role="slider"], input, [data-tile]'),
      )
    }

    const frame = () => {
      slow.x += (target.x - slow.x) * 0.14
      slow.y += (target.y - slow.y) * 0.14
      fast.x += (target.x - fast.x) * 0.42
      fast.y += (target.y - fast.y) * 0.42

      ring.style.transform =
        `translate3d(${slow.x}px, ${slow.y}px, 0) translate(-50%,-50%) scale(${over ? 2.1 : 1})`
      ring.style.borderColor = over
        ? 'rgba(79,216,232,0.85)'
        : 'rgba(142,166,192,0.4)'
      dot.style.transform = `translate3d(${fast.x}px, ${fast.y}px, 0) translate(-50%,-50%)`
      dot.style.opacity = over ? '0' : '1'

      raf = requestAnimationFrame(frame)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(frame)
    document.documentElement.style.cursor = 'none'

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
      document.documentElement.style.cursor = ''
    }
  }, [reduced])

  if (reduced) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] hidden md:block">
      <div
        ref={ringRef}
        className="absolute h-8 w-8 rounded-full border transition-[border-color] duration-300"
        style={{ borderColor: 'rgba(142,166,192,0.4)' }}
      />
      <div
        ref={dotRef}
        className="absolute h-1 w-1 rounded-full bg-gold transition-opacity duration-300"
      />
    </div>
  )
}
