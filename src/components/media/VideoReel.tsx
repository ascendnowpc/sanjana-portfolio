import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { LoopingPreview } from '@/components/media/LoopingPreview'
import { useIsMobile, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'
import { clamp, cn } from '@/lib/utils'

export interface ReelPiece {
  slug: string
  title: string
  /** Small line above the title, e.g. "Solo Concert — 2024". */
  meta: string
  poster: string
  /** Short silent loop; falls back to the full recording, then to the still. */
  src?: string
  /** width / height of the footage. */
  aspect: number
  accent: string
}

interface Props {
  items: ReelPiece[]
  /** Pixels per second. Positive drifts left → right. */
  speed?: number
  /** Row height. Every card is cut from it, so this sets the row's scale. */
  height?: string
  /** Must be stable — the cards are memoised against it. */
  onOpen: (piece: ReelPiece, el: HTMLElement) => void
  /** Told whether this row ended up drifting, so the page can decide whether
   *  to promise motion the row is not going to deliver. */
  onLoopingChange?: (looping: boolean) => void
  className?: string
}

/** Gap between cards, in px. Also the gap between repeats of the row. */
const GAP = 14

/**
 * How far a card's shape may be pushed to sit in the row.
 *
 * The archive is 21 landscape stage cameras and 15 vertical phone recordings,
 * and a row needs one height or it is not a row. Forcing both into a single
 * portrait frame would centre-crop 58% of the width off every landscape piece —
 * a group of four singers reduced to whoever stood in the middle. So the height
 * is uniform and the *width* follows the footage, clamped just enough to keep
 * the row from swinging between a postage stamp and a billboard: a 9:16 phone
 * clip loses 22% of its height, a 16:9 camera 25% of its width, and nothing
 * loses a performer.
 */
const RATIO_MIN = 0.72
const RATIO_MAX = 1.34

/**
 * How many cards may hold a video decoder at once.
 *
 * The same reasoning as the gallery wall's budget, at this surface's scale: a
 * browser has a small pool of hardware decoders, and a row that hands one to
 * every card it owns will stall the whole page. Only the cards nearest the
 * middle of the row get footage; the rest hold their poster.
 */
const MAX_PLAYING = 5
const MAX_PLAYING_MOBILE = 2

/** Ranking nudge for a card that already holds a decoder, so it doesn't flap
 *  between two cards sitting the same distance from the middle. */
const PLAY_STICKY = 60

/** How often the budget is re-cut, in ms. */
const BUDGET_MS = 220

/** Drag distance, in px, past which a pointer-up is a drag and not a click. */
const DRAG_SLOP = 6

/** The page gutter a still row is laid out inside, both sides together. */
const STILL_GUTTER = 96

/**
 * A drifting row of performance videos.
 *
 * The work index used to be a static grid of posters, which is a strange way
 * to show singing: the one thing every piece here has is movement, and none of
 * it was on screen. This is the same archive as a reel — footage playing in
 * rounded frames that travel steadily left to right, the way a strip of film
 * passes a gate.
 *
 * Three things about the mechanics:
 *
 * 1. The row is duplicated end to end and offset by a single transform, so the
 *    loop has no seam and no jump. Enough copies are mounted to cover the
 *    viewport at any offset — two for a long row, more when a filter has cut
 *    it down to three pieces.
 * 2. The offset is driven by rAF rather than a CSS animation, because the same
 *    number has to be readable (for the decoder budget) and writable (by a
 *    drag). Positions come from one measurement of the first copy, so the loop
 *    never asks the DOM anything and never forces a layout.
 * 3. It stops when it should: while hovered, while dragged, while focused, and
 *    while scrolled off screen. A row that keeps moving under a cursor trying
 *    to click it is a row you cannot use.
 */
export function VideoReel({
  items,
  speed = 30,
  height = 'clamp(200px, 26vw, 380px)',
  onOpen,
  onLoopingChange,
  className,
}: Props) {
  const reduced = usePrefersReducedMotion()
  const mobile = useIsMobile()

  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLUListElement>(null)

  /** Repeats of the row mounted end to end. Two covers a long row; a short
   *  one — a filter down to four or five pieces — needs more to reach the far
   *  edge of the screen at every offset. */
  const [copies, setCopies] = useState(2)
  const [playing, setPlaying] = useState<ReadonlySet<string>>(() => new Set())
  /**
   * Whether the row has more work than fits on screen.
   *
   * A category with one piece in it does not: looping it filled the row with
   * six copies of the same frame drifting past each other, which reads as a
   * bug rather than as a reel. A row that cannot overflow doesn't move — it
   * just sits in the page's gutter like the short list it is.
   */
  const [looping, setLooping] = useState(true)

  // Everything the loop reads lives in refs: it runs sixty times a second and
  // must never be a reason to re-render.
  const xRef = useRef(0)
  const seededRef = useRef(false)
  const periodRef = useRef(0)
  const viewportRef = useRef(0)
  const offsetsRef = useRef<number[]>([])
  const widthsRef = useRef<number[]>([])
  const onScreenRef = useRef(true)
  const playingRef = useRef(playing)
  const dragRef = useRef<{ last: number; moved: number } | null>(null)
  const suppressClickRef = useRef(false)
  /** Detaches an in-flight drag's window listeners. Held so unmounting in the
   *  middle of one — a filter changed with the pointer down — cannot leave
   *  them behind, still writing to a row that no longer exists. */
  const endDragRef = useRef<(() => void) | null>(null)
  useEffect(() => () => endDragRef.current?.(), [])

  // Hover and focus each hold the row still, and each has to let go on its own
  // terms: tabbing away from a card while the cursor still rests on the row is
  // not a reason to start moving again.
  const hoverRef = useRef(false)
  const focusRef = useRef(false)

  const n = items.length

  /**
   * Measure the first copy: where each card starts, how wide it is, and how
   * far the row travels before it repeats.
   *
   * Once per layout, never per frame. Card widths differ (see RATIO_MIN), so
   * this is the only way the loop can know where anything is — and knowing
   * lets it rank cards for the decoder budget with arithmetic instead of a few
   * hundred `getBoundingClientRect` calls a second.
   */
  useLayoutEffect(() => {
    const container = containerRef.current
    const copy = copyRef.current
    if (!container || !copy) return

    const measure = () => {
      const kids = Array.from(copy.children) as HTMLElement[]
      if (!kids.length) return
      const base = kids[0].offsetLeft
      offsetsRef.current = kids.map((k) => k.offsetLeft - base)
      widthsRef.current = kids.map((k) => k.offsetWidth)
      const period = copy.offsetWidth + GAP
      periodRef.current = period
      viewportRef.current = container.offsetWidth

      // Start part-way in, so the row reads as already running rather than as
      // a queue waiting to set off from the left edge.
      if (!seededRef.current && period > 0) {
        seededRef.current = true
        xRef.current = -period / 3
      }

      // Cover the viewport at every offset: the transform can be a full period
      // to the left, so the mounted copies have to span that plus the width.
      const needed = period > 0 ? Math.ceil(viewportRef.current / period) + 1 : 2
      setCopies((c) => (c === Math.max(2, needed) ? c : Math.max(2, needed)))
      // Measured against the unpadded width both ways round, so the branch
      // this decides can never change the measurement that decided it. The
      // allowance is the page's own gutter: a still row is laid out inside it,
      // and one that would spill out of it is better off drifting than sitting
      // behind a scrollbar of its own.
      setLooping(copy.offsetWidth > container.offsetWidth - STILL_GUTTER)
    }

    measure()
    // Cards are sized from the viewport and labelled in a web font, so both the
    // row's width and its period move after first paint.
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    ro.observe(copy)
    return () => ro.disconnect()
    // `looping` and `reduced` are here because each swaps the row for a
    // different pair of nodes: without them the observers would be left
    // watching the elements the last branch mounted, which are no longer in
    // the document.
  }, [items, height, looping, reduced])

  useEffect(() => {
    onLoopingChange?.(looping && !reduced)
  }, [looping, reduced, onLoopingChange])

  /** No decoders for a row nobody is looking at. */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreenRef.current = entry.isIntersecting
        if (!entry.isIntersecting && playingRef.current.size) {
          playingRef.current = new Set()
          setPlaying(playingRef.current)
        }
      },
      { rootMargin: '120px 0px' },
    )
    io.observe(container)
    return () => io.disconnect()
  }, [looping, reduced])

  /** The drift, and the decoder budget that rides on it. */
  useEffect(() => {
    if (reduced || !looping || !n) return
    const track = trackRef.current
    if (!track) return

    const max = mobile ? MAX_PLAYING_MOBILE : MAX_PLAYING
    let raf = 0
    let last = performance.now()
    let nextBudget = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      // Clamped: a backgrounded tab resumes with a gap of seconds, and an
      // unclamped step would teleport the row.
      const dt = Math.min(now - last, 64) / 1000
      last = now

      const period = periodRef.current
      if (period <= 0) return

      const held = hoverRef.current || focusRef.current || dragRef.current
      if (!held && onScreenRef.current) xRef.current += speed * dt

      // Wrapped into (-period, 0], so every card on screen is one of the
      // mounted copies and the arithmetic below stays finite.
      let x = xRef.current % period
      if (x > 0) x -= period
      xRef.current = x
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`

      if (now < nextBudget || !onScreenRef.current) return
      nextBudget = now + BUDGET_MS

      const offsets = offsetsRef.current
      const widths = widthsRef.current
      const viewport = viewportRef.current
      if (!offsets.length || viewport <= 0) return

      const centre = viewport / 2
      const prev = playingRef.current
      const ranked: { key: string; d: number }[] = []
      for (let c = 0; c < copies; c++) {
        for (let i = 0; i < offsets.length; i++) {
          const left = x + c * period + offsets[i]
          const w = widths[i]
          if (left + w <= 0 || left >= viewport) continue
          const key = `${c}:${i}`
          ranked.push({
            key,
            d:
              Math.abs(left + w / 2 - centre) -
              (prev.has(key) ? PLAY_STICKY : 0),
          })
        }
      }
      ranked.sort((a, b) => a.d - b.d)

      const next = new Set(ranked.slice(0, max).map((r) => r.key))
      if (next.size === prev.size && [...next].every((k) => prev.has(k))) return
      playingRef.current = next
      setPlaying(next)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduced, looping, mobile, speed, copies, n])

  /**
   * Bring a card the keyboard has just reached into the middle of the row.
   *
   * Tab order runs the length of the archive, most of which is off screen at
   * any moment; without this, focus would land somewhere invisible and the
   * focus ring would be the only thing telling you so.
   */
  const centreCard = useCallback((index: number) => {
    const period = periodRef.current
    const offsets = offsetsRef.current
    const widths = widthsRef.current
    if (!period || index >= offsets.length) return

    // Capped at zero rather than wrapped.
    //
    // Centring one of the first few cards wants a *positive* offset, and
    // wrapping that back into the loop's (-period, 0] range put the card a
    // whole period to the left — off screen, with its identical twin from the
    // next repeat sitting exactly where the focused card was meant to be. The
    // ring was on a frame nobody could see. Zero is the closest this row can
    // come: the run starts flush at the left edge, and an early card is whole
    // and on screen there, which is all the centring was ever for.
    const wanted = viewportRef.current / 2 - offsets[index] - widths[index] / 2
    let x = Math.min(0, wanted)
    if (x <= -period) x = (x % period) || 0
    xRef.current = x
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Cleared here rather than only where it is consumed: a gesture that ends
    // without a click ever arriving would otherwise leave the flag standing,
    // and the *next* visitor's click — a real one — would be the one swallowed.
    suppressClickRef.current = false
    dragRef.current = { last: e.clientX, moved: 0 }

    // Listened for on the window rather than captured on the row: capturing
    // the pointer retargets the click that follows to the capturing element,
    // and the card underneath would never hear it.
    const move = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = ev.clientX - drag.last
      drag.last = ev.clientX
      drag.moved += Math.abs(dx)
      xRef.current += dx
    }
    const up = () => {
      suppressClickRef.current = (dragRef.current?.moved ?? 0) > DRAG_SLOP
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      endDragRef.current = null
    }
    endDragRef.current = up
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  if (!n) return null

  const max = mobile ? MAX_PLAYING_MOBILE : MAX_PLAYING
  const row = (copy: number, still = false) =>
    items.map((piece, i) => (
      <ReelCard
        key={piece.slug}
        piece={piece}
        index={i}
        // Only the first copy is the real one. The repeats exist to close the
        // loop, and a screen reader or a Tab key finding the archive three
        // times over would be a bug, not thoroughness.
        interactive={copy === 0}
        // A row that never moves has no ranking to do: the cards that are on
        // screen are the cards that are on screen, and the budget is just the
        // first few of them.
        playing={still ? i < max : playing.has(`${copy}:${i}`)}
        onOpen={onOpen}
        onCentre={centreCard}
      />
    ))

  /**
   * Motion-sensitive visitors get the same row as a plain scroller: still
   * frames, no drift, no autoplay — everything reachable, nothing moving on
   * its own.
   */
  if (reduced || !looping) {
    return (
      <div
        ref={containerRef}
        className={cn('w-full overflow-x-auto overscroll-x-contain', className)}
        style={{ '--reel-h': height } as React.CSSProperties}
      >
        <div className="flex w-max px-6 md:px-12" style={{ gap: GAP }}>
          {/* The measuring copy either way: the layout effect reads this node
              to decide which of these two branches should be on screen. */}
          <ul ref={copyRef} className="flex shrink-0" style={{ gap: GAP }}>
            {/* Stills only for a motion-sensitive visitor — a row of
                autoplaying video is the thing they asked not to be given. */}
            {row(0, !reduced)}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full touch-pan-y overflow-hidden select-none',
        className,
      )}
      style={{ '--reel-h': height } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onDragStart={(e) => e.preventDefault()}
      onPointerEnter={() => {
        hoverRef.current = true
      }}
      onPointerLeave={() => {
        hoverRef.current = false
      }}
      onFocusCapture={() => {
        focusRef.current = true
      }}
      onBlurCapture={() => {
        focusRef.current = false
      }}
      // A card reached by Tab is scrolled into view by the browser, which would
      // shift the row out from under the transform that positions it.
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0
      }}
      onClickCapture={(e) => {
        if (!suppressClickRef.current) return
        suppressClickRef.current = false
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div
        ref={trackRef}
        className="flex w-max will-change-transform"
        style={{ gap: GAP }}
      >
        {Array.from({ length: copies }, (_, c) => (
          <ul
            key={c}
            ref={c === 0 ? copyRef : undefined}
            className="flex shrink-0"
            style={{ gap: GAP }}
            aria-hidden={c > 0}
          >
            {row(c)}
          </ul>
        ))}
      </div>
    </div>
  )
}

interface CardProps {
  piece: ReelPiece
  index: number
  playing: boolean
  interactive: boolean
  onOpen: (piece: ReelPiece, el: HTMLElement) => void
  onCentre: (index: number) => void
}

/**
 * One frame in the reel.
 *
 * Memoised, and every prop it takes is either a primitive or a stable
 * callback: the row re-renders each time the decoder budget moves, and only
 * the two or three cards that actually changed hands should do any work.
 */
const ReelCard = memo(function ReelCard({
  piece,
  index,
  playing,
  interactive,
  onOpen,
  onCentre,
}: CardProps) {
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const ratio = clamp(piece.aspect || 16 / 9, RATIO_MIN, RATIO_MAX)
  const poster = mediaUrl(piece.poster)
  const src = mediaUrl(piece.src)
  // Hovering earns footage even if the card missed the ambient cut.
  const showVideo = Boolean(src) && (playing || hover)

  return (
    <li
      className="shrink-0"
      style={{
        height: 'var(--reel-h)',
        width: `calc(var(--reel-h) * ${ratio})`,
      }}
    >
      <button
        ref={ref}
        type="button"
        tabIndex={interactive ? 0 : -1}
        aria-hidden={!interactive}
        onClick={() => ref.current && onOpen(piece, ref.current)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={(e) => {
          setHover(true)
          // Only for focus that arrived from the keyboard.
          //
          // Chromium focuses a button on mousedown, so centring on every focus
          // meant pressing a card yanked the row sideways under the cursor —
          // and because mousedown and mouseup then landed on two different
          // cards, the browser dispatched the click on their common ancestor
          // instead of on either one. Clicking a frame did nothing at all.
          if (interactive && e.currentTarget.matches(':focus-visible')) {
            onCentre(index)
          }
        }}
        onBlur={() => setHover(false)}
        className="group relative block h-full w-full cursor-pointer overflow-hidden rounded-2xl bg-ink text-left"
        style={{
          transition: 'box-shadow 500ms, transform 600ms var(--ease-out-expo)',
          transform: hover ? 'translateY(-6px)' : 'none',
          boxShadow: hover
            ? `0 0 0 1px ${piece.accent}66, 0 46px 90px -40px ${piece.accent}bb`
            : '0 0 0 1px rgba(232,241,248,0.06)',
        }}
      >
        {/* The dimming sits on the pair, not on the picture.

            It used to live on the `<img>` alone, and the moment a card was
            handed a decoder its video painted over the top at full brightness —
            so the three or four cards currently playing lit up as if they were
            all being hovered, and the row lost the one thing the dimming is
            for. */}
        <div
          className="absolute inset-0"
          style={{
            transition: 'filter 600ms',
            // Dimmed at rest so the row reads as one strip rather than as a
            // dozen pictures competing; the card being looked at comes up to
            // full brightness on its own.
            filter: hover ? 'brightness(1)' : 'brightness(0.8)',
          }}
        >
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              transition: 'transform 1400ms var(--ease-out-expo)',
              transform: hover ? 'scale(1.05)' : 'scale(1.01)',
            }}
          />

          {/* Always the short silent loop, never the full recording: several of
              these run at once, and pointing them at four-minute files would
              pull hundreds of megabytes through the row. */}
          {showVideo && (
            <LoopingPreview
              src={src!}
              poster={poster}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>

        {/* Sized and weighted for the brightest thing in the archive: a hall
            full of choir robes under white stage wash, which a lighter gradient
            left the caption sitting invisibly on top of. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.45) 38%, transparent)',
          }}
        />

        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
          <p className="label on-scrim mb-2 text-mist">{piece.meta}</p>
          <h3
            className="tracked-tight on-scrim text-[clamp(0.72rem,0.95vw,0.95rem)] leading-snug text-chalk transition-colors duration-300"
            style={{ color: hover ? piece.accent : undefined }}
          >
            {piece.title}
          </h3>
        </div>
      </button>
    </li>
  )
})
