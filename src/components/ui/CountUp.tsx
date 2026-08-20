import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

interface Props {
  to: number
  /** Rendered after the number, inside the same element. */
  suffix?: string
  className?: string
}

/**
 * A figure that counts up the first time it is seen.
 *
 * Driven by its own rAF rather than a motion value, because the only thing
 * changing is one text node — routing that through React state would re-render
 * a component sixty times a second to write four characters.
 */
export function CountUp({ to, suffix = '', className }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.textContent = `${to}${suffix}`
      return
    }

    let raf = 0
    let start = 0
    const DURATION = 1400

    const run = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / DURATION)
      // Expo out, matching the easing the rest of the site moves on.
      const eased = 1 - Math.pow(1 - t, 4)
      el.textContent = `${Math.round(to * eased)}${suffix}`
      if (t < 1) raf = requestAnimationFrame(run)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        raf = requestAnimationFrame(run)
      },
      { rootMargin: '-80px' },
    )
    io.observe(el)

    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, suffix, reduced])

  // Rendered with the final value so the figure is correct with JS disabled
  // and for anything reading the page rather than watching it.
  return (
    <span ref={ref} className={className}>
      {to}
      {suffix}
    </span>
  )
}
