import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

interface Props {
  text: string
  /** A frame is being read. The label lingers a moment after this goes
   *  false — see LINGER_MS. */
  visible: boolean
}

/** Where the first letter sits against the cursor, in px: just right of the
 *  pointer's tip, with the word's middle level with it. */
const OFFSET_X = 18
const OFFSET_Y = -9
/** Per-frame share of the distance the first letter closes on the cursor. */
const LEAD = 0.3
/** Per-frame share each later letter closes on its place behind the one in
 *  front. Lower than LEAD, so the word stretches out behind a moving hand. */
const FOLLOW = 0.2
/** Per-frame share of the way a letter turns toward the line it is on. */
const TURN = 0.35
/**
 * How long the label stays after the frame under it is let go.
 *
 * Focus is dropped the moment the hand starts moving (see the gallery), and
 * moving is exactly when the trail is worth seeing. So the word is not taken
 * away with the focus; it keeps following for a beat, strung out behind the
 * hand, and only then fades — unless the hand settles on another frame first,
 * in which case it simply carries on.
 */
const LINGER_MS = 650
const FADE_MS = 260

/**
 * The invitation on the index, carried by the cursor — as a chain of letters.
 *
 * The reference's "learn more" is not a label bolted to the pointer. Its first
 * letter chases the pointer and every letter after it chases the one in front,
 * each holding the place it has in the word. Held still, that settles into the
 * word, reading left to right from the pointer. Moved, every letter lags a
 * little more than the one before it, so the word pays out behind the hand
 * along the path it took, each letter turned to the line it is on — upside
 * down, for a moment, when the hand doubles back — and gathers up again when
 * the hand stops.
 *
 * The letters' places are measured off the same lettering laid out flat and
 * hidden, so the settled word is exactly the word, tracking and all.
 *
 * Everything moving is written straight to transforms from a rAF loop that
 * only runs while the label can be seen: the index is already turning eighty
 * frames on the main thread, and a re-render per mouse move would be a
 * strange thing to add to that.
 */
export function CursorLabel({ text, visible }: Props) {
  const reduced = usePrefersReducedMotion()
  const letters = Array.from(text, (ch) => (ch === ' ' ? ' ' : ch))

  const layerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([])
  /** Each letter's distance along the settled word from the first, in px. */
  const offsets = useRef<number[]>([])

  /** Where the pointer is; kept while hidden, so the word appears at the
   *  cursor rather than flying in from wherever it was last seen. */
  const pointer = useRef({ x: -400, y: -400 })
  const pos = useRef<{ x: number; y: number; a: number }[]>([])

  /** Whether the loop should be running: on while visible and through the
   *  linger and fade after. */
  const [live, setLive] = useState(false)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  /** When the label last stopped being wanted, for the linger. */
  const releasedAt = useRef(0)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX
      pointer.current.y = e.clientY
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // The settled word's letter places, from the hidden copy. Again once the
  // web font is in, since the fallback's widths are not the font's.
  useLayoutEffect(() => {
    const measure = () => {
      const row = measureRef.current
      if (!row) return
      const spans = Array.from(row.children) as HTMLElement[]
      const first = spans[0]?.offsetLeft ?? 0
      offsets.current = spans.map((s) => s.offsetLeft - first)
    }
    measure()
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) measure()
    })
    window.addEventListener('resize', measure)
    return () => {
      cancelled = true
      window.removeEventListener('resize', measure)
    }
  }, [text])

  useEffect(() => {
    if (visible) setLive(true)
    else releasedAt.current = performance.now()
  }, [visible])

  useLayoutEffect(() => {
    if (!live) return
    const layer = layerRef.current
    if (!layer) return

    // Arrive gathered on the cursor, and pay out into the word from there —
    // unless the letters are still on screen from a moment ago, in which
    // case they carry on from where they are.
    const head = () => ({
      x: pointer.current.x + OFFSET_X,
      y: pointer.current.y + OFFSET_Y,
    })
    if (pos.current.length !== letters.length || layer.style.opacity === '0') {
      const h = head()
      pos.current = letters.map(() => ({ x: h.x, y: h.y, a: 0 }))
    }

    let raf = 0
    let last = 0
    let alpha = Number(layer.style.opacity || 0)

    const tick = (now: number) => {
      const f = last ? Math.min(4, (now - last) / 16.667) : 1
      last = now
      const ease = (k: number) => (reduced ? 1 : 1 - Math.pow(1 - k, f))
      const p = pos.current
      const off = offsets.current

      const h = head()
      p[0].x += (h.x - p[0].x) * ease(LEAD)
      p[0].y += (h.y - p[0].y) * ease(LEAD)
      for (let i = 1; i < p.length; i++) {
        const gap = (off[i] ?? 0) - (off[i - 1] ?? 0)
        p[i].x += (p[i - 1].x + gap - p[i].x) * ease(FOLLOW)
        p[i].y += (p[i - 1].y - p[i].y) * ease(FOLLOW)
      }

      // Each letter turns to the line between it and the next one along —
      // the first and last to their only neighbour — eased, and the long
      // way round never.
      for (let i = 0; i < p.length; i++) {
        const a = p[Math.max(0, i - 1)]
        const b = p[Math.min(p.length - 1, Math.max(1, i))]
        const want =
          i === 0
            ? Math.atan2(p[1]?.y - p[0].y || 0, p[1]?.x - p[0].x || 1)
            : Math.atan2(b.y - a.y, b.x - a.x)
        let d = want - p[i].a
        d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
        p[i].a += d * ease(TURN)
      }

      letterRefs.current.forEach((el, i) => {
        if (!el || !p[i]) return
        el.style.transform = `translate3d(${p[i].x.toFixed(1)}px, ${p[i].y.toFixed(1)}px, 0) rotate(${p[i].a.toFixed(3)}rad)`
      })

      // In quickly; out only once the linger has run.
      const wanted =
        visibleRef.current || now - releasedAt.current < LINGER_MS ? 1 : 0
      const step = (dt: number) => Math.min(1, dt / (wanted ? 140 : FADE_MS))
      alpha += (wanted - alpha) * step(f * 16.667)
      if (Math.abs(wanted - alpha) < 0.01) alpha = wanted
      layer.style.opacity = alpha.toFixed(3)

      if (!wanted && alpha === 0) {
        setLive(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // `letters` is derived from `text` on every render; the loop only has to
    // be rebuilt when the words themselves change.
  }, [live, reduced, text])

  // Bare lettering, no box. The cursor is over footage by definition, so the
  // letters carry a heavier shadow than the site's usual scrim to stay legible
  // on a bright stage shot.
  const type = 'tracked whitespace-nowrap text-chalk'
  const style = {
    fontSize: 'clamp(0.72rem, 1.3vw, 1.08rem)',
    textShadow:
      '0 0 2px rgba(0,0,0,0.95), 0 1px 6px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.75)',
  }

  return (
    <>
      {/* The word laid out flat and out of sight, to measure the letters'
          places against. */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className={`${type} pointer-events-none invisible fixed top-0 left-0`}
        style={style}
      >
        {letters.map((ch, i) => (
          <span key={i} className="inline-block">
            {ch}
          </span>
        ))}
      </span>

      <div
        ref={layerRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-20"
        style={{ opacity: 0 }}
      >
        {live &&
          letters.map((ch, i) => (
            <span
              key={i}
              ref={(el) => {
                letterRefs.current[i] = el
              }}
              className={`${type} absolute top-0 left-0 inline-block origin-left will-change-transform`}
              style={style}
            >
              {ch}
            </span>
          ))}
      </div>
    </>
  )
}
