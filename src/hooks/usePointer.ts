import { useEffect, useRef } from 'react'

/**
 * Pointer position as -1..1 from the centre of the viewport, smoothed.
 *
 * Deliberately a ref, not state: consumers read it inside their own rAF loop,
 * so moving the mouse never triggers a React render.
 */
export function usePointer(smoothing = 0.08) {
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })
  /** Raw viewport coordinates, for hit-testing moving elements. */
  const client = useRef({ x: -1, y: -1 })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1
      client.current.x = e.clientX
      client.current.y = e.clientY
    }
    const onLeave = () => {
      target.current.x = 0
      target.current.y = 0
      client.current.x = -1
      client.current.y = -1
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  /**
   * Call once per frame; returns the eased position.
   *
   * `f` is the frame's length in 60fps units. Without it the easing is per
   * *frame* rather than per second, so the pointer lags twice as far behind on
   * a 120Hz display as on a 60Hz one and the follow feels different on every
   * machine. Compounding the rate over `f` frames fixes that exactly.
   */
  const step = (f = 1) => {
    const k = f === 1 ? smoothing : 1 - Math.pow(1 - smoothing, f)
    current.current.x += (target.current.x - current.current.x) * k
    current.current.y += (target.current.y - current.current.y) * k
    return current.current
  }

  return { step, target, current, client }
}
