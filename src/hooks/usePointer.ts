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

  /** Call once per frame; returns the eased position. */
  const step = () => {
    current.current.x += (target.current.x - current.current.x) * smoothing
    current.current.y += (target.current.y - current.current.y) * smoothing
    return current.current
  }

  return { step, target, current, client }
}
