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
}

interface Props {
  items: ReelPiece[]
  /** Pixels per second. Positive drifts left → right. */
  speed?: number
  /** Must be stable — the cards are memoised against it. */
  onOpen: (piece: ReelPiece, el: HTMLElement) => void
  /** Told whether this strip ended up drifting, so the page can decide
   *  whether to promise motion it is not going to deliver. */
  onLoopingChange?: (looping: boolean) => void
  className?: string
}

/**
 * The card's shape, and how many of them a screen holds.
 *
 * Both taken off the reference: tall frames, four across, with air between
 * them. Everything else about the strip's scale follows from these two
 * numbers — the card is a quarter of the screen wide, and as tall as that
 * shape makes it.
 */
const RATIO = 0.76
function perView(width: number) {
  if (width >= 1600) return 4.2
  if (width >= 1180) return 4
  if (width >= 860) return 3
  if (width >= 600) return 2.1
  return 1.25
}

/** Air between cards. The reference's gap is about a fifteenth of a card. */
function gapFor(width: number) {
  return width >= 860 ? 30 : 16
}

/**
 * A ceiling on card height, as a share of the window.
 *
 * A quarter of a 2560px screen is a 600px-wide card, which at this shape is
 * 790px tall — taller than the screen it is on. Past this point the strip
 * stops growing and simply fits more cards on.
 */
const MAX_HEIGHT_VH = 0.56

/** The size a card comes out at on a given screen. */
export function reelCardSize(width: number, height: number) {
  const gap = gapFor(width)
  const across = perView(width)
  const h = Math.min(
    (width - across * gap) / across / RATIO,
    height * MAX_HEIGHT_VH,
  )
  return { gap, width: Math.round(h * RATIO), height: Math.round(h) }
}

/**
 * How many pieces belong in one strip.
 *
 * Short strips are the point — a handful of work each, several of them down
 * the page — but a strip still has to be wider than the screen it loops
 * across. One narrower than that would show the same piece twice at once,
 * which reads as a bug rather than as a loop. So: the fewest cards that cover
 * the screen, and never fewer than four.
 */
export function piecesPerReel(width: number, height: number) {
  const card = reelCardSize(width, height)
  return Math.max(4, Math.ceil((width + card.gap) / (card.width + card.gap)))
}

/**
 * The 3D pose, as a function of where a card sits across the screen.
 *
 * The strip is read as the surface of a slowly turning cylinder: the card in
 * the middle faces you, the ones at either end are angled away and set back.
 * This is what stops a row of rectangles from looking like a contact sheet
 * that happens to slide.
 *
 * The vanishing point is the card's own — `perspective()` inside its
 * transform, rather than a `perspective` on the strip around it. Two reasons.
 * A shared vanishing point projects a card at the edge of the screen off-axis,
 * which skews its horizontal edges out of level: the row looked like it was
 * sliding downhill. And a shared one needs `transform-style: preserve-3d` on
 * the element the travel animates, which is the one thing that must stay a
 * plain 2D transform if the compositor is to own it.
 */
const LENS = 2200
const TILT = 13
const DEPTH = 55

/**
 * How many cards may hold a video decoder at once, per strip.
 *
 * A browser has a small pool of hardware decoders, and strips that each hand
 * one to every card they own would stall the page — which is exactly what the
 * drift would show. Only the strips on screen play at all (see the observer
 * below), and within one, only the cards nearest the middle.
 */
const MAX_PLAYING = 4
const MAX_PLAYING_MOBILE = 2

/**
 * How much of a strip has to be on screen before it is given footage.
 *
 * Several strips down a page means several claims on the same small pool of
 * decoders: at one point three strips had a sliver each in view and fifteen
 * videos running between them. Travel is granted to any strip with a sliver
 * showing — a frozen strip sliding into view looks broken — but footage only
 * to one you are actually looking at.
 */
const PLAY_RATIO = 0.55

/** Ranking nudge for a card that already holds a decoder, so it doesn't flap
 *  between two cards sitting the same distance from the middle. */
const PLAY_STICKY = 90

/** How often the budget is re-cut, in ms. */
const BUDGET_MS = 320

/** Drag distance, in px, past which a pointer-up is a drag and not a click. */
const DRAG_SLOP = 6

/** The page gutter a still strip is laid out inside, both sides together. */
const STILL_GUTTER = 96

/**
 * Where the crop is taken from.
 *
 * The archive is 21 landscape stage cameras and 15 vertical phone recordings
 * and the strip has one card shape, so every frame is filled to it rather
 * than fitted inside it — a letterboxed clip in a tall card is a small
 * picture in a dark box, and next to a card that fills its frame it reads as
 * broken. The crop is taken above centre because what a wide stage shot has
 * too much of is floor, and what it cannot afford to lose is faces.
 */
const CROP = '50% 42%'

/**
 * A drifting strip of performance videos.
 *
 * The work index used to be a static grid of posters, which is a strange way
 * to show singing: the one thing every piece here has is movement, and none of
 * it was on screen. This is the same archive as reels — footage playing in
 * rounded frames that travel steadily left to right, the way a strip of film
 * passes a gate.
 *
 * Three things about the mechanics:
 *
 * 1. The strip is duplicated end to end, so the loop has no seam and no jump.
 *    Enough copies are mounted to cover the screen at any offset.
 * 2. **The travel is a real animation, not a transform written every frame.**
 *    It was the latter, and on a machine that is also decoding five videos
 *    that is a promise the main thread cannot keep: every hitch in React, in
 *    a decoder, in the garbage collector, was a hitch in the drift. Handing
 *    the translation to the compositor as a `Web Animation` takes it off the
 *    main thread entirely, and `currentTime` remains readable (for the decoder
 *    budget and the 3D pose) and writable (by a drag, and by the Tab key), so
 *    nothing was given up for it.
 * 3. It stops when it should: while hovered, while dragged, while focused, and
 *    while scrolled off screen. A strip that keeps moving under a cursor
 *    trying to click it is a strip you cannot use.
 */
export function VideoReel({
  items,
  speed = 34,
  onOpen,
  onLoopingChange,
  className,
}: Props) {
  const reduced = usePrefersReducedMotion()
  const mobile = useIsMobile()

  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLUListElement>(null)

  /** Repeats of the strip mounted end to end. */
  const [copies, setCopies] = useState(2)
  const [playing, setPlaying] = useState<ReadonlySet<string>>(() => new Set())
  /**
   * Whether the strip has more work than fits on screen.
   *
   * A category with one piece in it does not: looping it filled the row with
   * copies of the same frame drifting past each other. A strip that cannot
   * overflow doesn't move — it just sits in the page's gutter like the short
   * list it is.
   */
  const [looping, setLooping] = useState(true)

  // Everything the animation and the frame loop read lives in refs.
  const animRef = useRef<Animation | null>(null)
  const periodRef = useRef(0)
  const viewportRef = useRef(0)
  const offsetsRef = useRef<number[]>([])
  const widthsRef = useRef<number[]>([])
  const cellsRef = useRef<
    { el: HTMLElement; copy: number; index: number; last: number }[]
  >([])
  const progressRef = useRef(1 / 3)
  /** Any part on screen: enough to keep travelling. */
  const onScreenRef = useRef(false)
  /** Enough of it on screen to be worth a decoder. See PLAY_RATIO. */
  const inViewRef = useRef(false)
  const playingRef = useRef(playing)
  const dragRef = useRef<{ last: number; moved: number } | null>(null)
  const suppressClickRef = useRef(false)
  const endDragRef = useRef<(() => void) | null>(null)
  useEffect(() => () => endDragRef.current?.(), [])

  // Hover and focus each hold the strip still, and each has to let go on its
  // own terms: tabbing away from a card while the cursor still rests on the
  // strip is not a reason to start moving again.
  const hoverRef = useRef(false)
  const focusRef = useRef(false)

  const n = items.length

  /** Plays only when every reason to hold still has gone away. */
  const syncPlayState = useCallback(() => {
    const anim = animRef.current
    if (!anim) return
    const hold =
      hoverRef.current || focusRef.current || dragRef.current || !onScreenRef.current
    if (hold) anim.pause()
    else anim.play()
  }, [])

  /** Where the strip is right now, in px, without asking the DOM. */
  const offsetNow = useCallback(() => {
    const anim = animRef.current
    const period = periodRef.current
    if (!anim || !period) return 0
    const duration = (anim.effect?.getTiming().duration as number) || 1
    const t = Number(anim.currentTime ?? 0)
    const progress = (((t % duration) + duration) % duration) / duration
    return -period + progress * period
  }, [])

  /**
   * Size the cards to the screen, measure where they landed, and hand the
   * travel to the compositor.
   *
   * The card size is written as custom properties rather than held in state:
   * this runs on every resize, and a strip that re-rendered every card to
   * change a width would be doing it mid-drift. The measurement that follows
   * is what lets the frame loop place the 3D pose and rank cards for the
   * decoder budget with arithmetic instead of a few hundred
   * `getBoundingClientRect` calls a second.
   */
  useLayoutEffect(() => {
    const container = containerRef.current
    const copy = copyRef.current
    const track = trackRef.current
    if (!container || !copy) return

    const measure = () => {
      const width = container.offsetWidth
      if (!width) return

      const card = reelCardSize(width, window.innerHeight)
      container.style.setProperty('--reel-w', `${card.width}px`)
      container.style.setProperty('--reel-h', `${card.height}px`)
      container.style.setProperty('--reel-gap', `${card.gap}px`)

      const kids = Array.from(copy.children) as HTMLElement[]
      if (!kids.length) return
      const base = kids[0].offsetLeft
      offsetsRef.current = kids.map((k) => k.offsetLeft - base)
      widthsRef.current = kids.map((k) => k.offsetWidth)
      const period = copy.offsetWidth + card.gap
      periodRef.current = period
      viewportRef.current = width

      // Cover the screen at every offset: the travel is a full period wide, so
      // the mounted copies have to span that plus the width.
      const needed = period > 0 ? Math.ceil(width / period) + 1 : 2
      setCopies((c) => (c === Math.max(2, needed) ? c : Math.max(2, needed)))
      // Measured against the unpadded width both ways round, so the branch
      // this decides can never change the measurement that decided it. The
      // allowance is the page's own gutter: a still strip is laid out inside
      // it, and one that would spill out of it is better off drifting than
      // sitting behind a scrollbar of its own.
      setLooping(copy.offsetWidth > width - STILL_GUTTER)

      if (!track || reduced) return
      cellsRef.current = Array.from(track.children).flatMap((ul, c) =>
        Array.from(ul.children).map((el, index) => ({
          el: el as HTMLElement,
          copy: c,
          index,
          last: NaN,
        })),
      )

      // Rebuilt rather than retimed, because the distance changed with the
      // card size — resumed at the same point in the loop so a resize does not
      // send the strip back to the beginning.
      const previous = animRef.current
      if (previous) {
        const d = (previous.effect?.getTiming().duration as number) || 1
        const t = Number(previous.currentTime ?? 0)
        progressRef.current = (((t % d) + d) % d) / d
        previous.cancel()
      }
      const anim = track.animate(
        [
          { transform: `translate3d(${-period}px, 0, 0)` },
          { transform: 'translate3d(0px, 0, 0)' },
        ],
        { duration: (period / speed) * 1000, iterations: Infinity, easing: 'linear' },
      )
      anim.currentTime = progressRef.current * (period / speed) * 1000
      animRef.current = anim
      syncPlayState()
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    ro.observe(copy)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      animRef.current?.cancel()
      animRef.current = null
    }
    // `looping` and `reduced` are here because each swaps the strip for a
    // different set of nodes: without them the observers would be left
    // watching elements that are no longer in the document.
  }, [items, looping, reduced, speed, copies, syncPlayState])

  useEffect(() => {
    onLoopingChange?.(looping && !reduced)
  }, [looping, reduced, onLoopingChange])

  /**
   * Nothing runs for a strip nobody is looking at.
   *
   * There are several of these down the page now, and an off-screen one keeps
   * neither a decoder nor an animation: no margin on the observer, because a
   * strip one screen away is a strip whose five videos are worth nothing.
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreenRef.current = entry.isIntersecting
        // Read off the ratio rather than `isIntersecting`, which is true for a
        // single overlapping pixel whatever thresholds are set.
        inViewRef.current = entry.intersectionRatio >= PLAY_RATIO
        syncPlayState()
        if (!inViewRef.current && playingRef.current.size) {
          playingRef.current = new Set()
          setPlaying(playingRef.current)
        }
      },
      { rootMargin: '0px', threshold: [0, PLAY_RATIO, 1] },
    )
    io.observe(container)
    return () => io.disconnect()
  }, [looping, reduced, syncPlayState])

  /**
   * The 3D pose, and the decoder budget.
   *
   * This is all that is left on the main thread each frame: a handful of
   * transform writes on the cards that are actually on screen. The travel
   * itself is the compositor's, so a slow frame here tilts a card a moment
   * late — it does not stutter the strip.
   */
  useEffect(() => {
    if (reduced || !looping || !n) return

    const max = mobile ? MAX_PLAYING_MOBILE : MAX_PLAYING
    let raf = 0
    let nextBudget = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!onScreenRef.current) return
      const scored = inViewRef.current

      const period = periodRef.current
      const viewport = viewportRef.current
      const offsets = offsetsRef.current
      const widths = widthsRef.current
      if (period <= 0 || viewport <= 0 || !offsets.length) return

      const x = offsetNow()
      const centre = viewport / 2

      for (const cell of cellsRef.current) {
        const left = x + cell.copy * period + offsets[cell.index]
        const t = clamp(
          (left + widths[cell.index] / 2 - centre) / centre,
          -1.35,
          1.35,
        )
        // Skipped when nothing moved enough to see: a card parked off the side
        // of the screen holds its pose for whole seconds at a time.
        if (Math.abs(t - cell.last) < 0.004) continue
        cell.last = t
        cell.el.style.transform = `perspective(${LENS}px) translateZ(${(-Math.abs(t) * DEPTH).toFixed(1)}px) rotateY(${(-t * TILT).toFixed(2)}deg)`
      }

      if (now < nextBudget || !scored) return
      nextBudget = now + BUDGET_MS

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
  }, [reduced, looping, mobile, copies, n, offsetNow])

  /** Move the strip to a given offset — a drag, or a jump to a card. */
  const travelTo = useCallback((x: number) => {
    const anim = animRef.current
    const period = periodRef.current
    if (!anim || !period) return
    const duration = (anim.effect?.getTiming().duration as number) || 1
    let progress = ((x + period) / period) % 1
    if (progress <= 0) progress += 1
    // Never exactly 1. That is the boundary between two iterations, and the
    // animation renders it as the *start* of the next one — a whole period to
    // the left of where it was asked to go. Tabbing to one of the first cards
    // in a strip asks for precisely that offset, and landed the focus ring on
    // a card off the side of the screen.
    anim.currentTime = Math.min(progress, 1 - 1e-6) * duration
  }, [])

  /**
   * Bring a card the keyboard has just reached onto the screen.
   *
   * Tab order runs the length of the strip, some of which is off screen at any
   * moment; without this, focus could land somewhere invisible and the focus
   * ring would be the only thing telling you so.
   *
   * Capped at zero rather than wrapped: centring one of the first cards wants
   * a *positive* offset, and wrapping that back into the loop's range put the
   * card a whole period to the left — off screen, with its identical twin from
   * the next repeat sitting exactly where the focused card was meant to be.
   */
  const centreCard = useCallback(
    (index: number) => {
      const offsets = offsetsRef.current
      const widths = widthsRef.current
      if (index >= offsets.length) return
      const wanted =
        viewportRef.current / 2 - offsets[index] - widths[index] / 2
      travelTo(Math.min(0, wanted))
    },
    [travelTo],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Cleared here rather than only where it is consumed: a gesture that ends
    // without a click ever arriving would otherwise leave the flag standing,
    // and the *next* visitor's click — a real one — would be the one swallowed.
    suppressClickRef.current = false
    dragRef.current = { last: e.clientX, moved: 0 }
    syncPlayState()

    // Listened for on the window rather than captured on the strip: capturing
    // the pointer retargets the click that follows to the capturing element,
    // and the card underneath would never hear it.
    const move = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = ev.clientX - drag.last
      drag.last = ev.clientX
      drag.moved += Math.abs(dx)
      travelTo(offsetNow() + dx)
    }
    const up = () => {
      suppressClickRef.current = (dragRef.current?.moved ?? 0) > DRAG_SLOP
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      endDragRef.current = null
      syncPlayState()
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
        // loop, and a screen reader or a Tab key finding the archive twice
        // over would be a bug, not thoroughness.
        interactive={copy === 0}
        // A strip that never moves has no ranking to do: the cards that are on
        // screen are the cards that are on screen.
        playing={still ? i < max : playing.has(`${copy}:${i}`)}
        onOpen={onOpen}
        onCentre={centreCard}
      />
    ))

  /**
   * Motion-sensitive visitors, and strips too short to travel, get the same
   * cards as a plain scroller: nothing drifting, nothing to chase.
   */
  if (reduced || !looping) {
    return (
      <div
        ref={containerRef}
        className={cn('w-full overflow-x-auto overscroll-x-contain', className)}
      >
        <div
          className="flex w-max px-6 md:px-12"
          style={{ gap: 'var(--reel-gap)' }}
        >
          {/* The measuring copy either way: the layout effect reads this node
              to decide which of these two branches should be on screen. */}
          <ul
            ref={copyRef}
            className="flex shrink-0"
            style={{ gap: 'var(--reel-gap)' }}
          >
            {/* Stills only for a motion-sensitive visitor — a strip of
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
      onPointerDown={onPointerDown}
      onDragStart={(e) => e.preventDefault()}
      onPointerEnter={() => {
        hoverRef.current = true
        syncPlayState()
      }}
      onPointerLeave={() => {
        hoverRef.current = false
        syncPlayState()
      }}
      onFocusCapture={() => {
        focusRef.current = true
        syncPlayState()
      }}
      onBlurCapture={() => {
        focusRef.current = false
        syncPlayState()
      }}
      // A card reached by Tab is scrolled into view by the browser, which would
      // shift the strip out from under the animation that positions it.
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
        style={{ gap: 'var(--reel-gap)' }}
      >
        {Array.from({ length: copies }, (_, c) => (
          <ul
            key={c}
            ref={c === 0 ? copyRef : undefined}
            className="flex shrink-0"
            style={{ gap: 'var(--reel-gap)' }}
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
 * One frame in the strip.
 *
 * Memoised, and every prop it takes is either a primitive or a stable
 * callback: the strip re-renders each time the decoder budget moves, and only
 * the card that actually changed hands should do any work.
 *
 * The `<li>` is posed in 3D by the frame loop and nothing else touches its
 * transform; the hover lift lives on the button inside it, so the two never
 * write over each other.
 *
 * There is no colour in here on purpose. Each category used to light its own
 * hover — cyan, amber, violet, rose — so running a cursor along the strip
 * flashed through a paintbox. The reference lifts a frame with nothing but its
 * own picture and plain white light, and the gallery wall reached the same
 * conclusion.
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
  const poster = mediaUrl(piece.poster)
  const src = mediaUrl(piece.src)
  // Hovering earns footage even if the card missed the ambient cut.
  const showVideo = Boolean(src) && (playing || hover)

  return (
    <li
      className="shrink-0"
      style={{
        width: 'var(--reel-w)',
        height: 'var(--reel-h)',
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        // Posed by the strip's frame loop; the hover lift below lives on the
        // button inside, so the two never write over each other.
        transform: `perspective(${LENS}px)`,
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
          // meant pressing a card yanked the strip sideways under the cursor —
          // and because mousedown and mouseup then landed on two different
          // cards, the browser dispatched the click on their common ancestor
          // instead of on either one. Clicking a frame did nothing at all.
          if (interactive && e.currentTarget.matches(':focus-visible')) {
            onCentre(index)
          }
        }}
        onBlur={() => setHover(false)}
        className="group relative block h-full w-full cursor-pointer overflow-hidden rounded-[20px] bg-ink text-left"
        style={{
          transition: 'box-shadow 600ms, transform 700ms var(--ease-out-expo)',
          // Comes off the surface toward the viewer, rather than sliding up
          // the page: the card is a thing standing in space now, and a lift
          // that ignores that reads as a sticker peeling.
          transform: hover ? 'translateZ(60px)' : 'none',
          // The ground shadow is what sells the depth — a card with none looks
          // painted on. It deepens and spreads as the card comes forward.
          boxShadow: hover
            ? '0 0 0 1px rgba(255,255,255,0.4), 0 60px 90px -30px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.16)'
            : '0 30px 55px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)',
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
            objectPosition: CROP,
            transition: 'transform 1600ms var(--ease-out-expo)',
            transform: hover ? 'scale(1.04)' : 'scale(1)',
          }}
        />

        {/* Always the short silent loop, never the full recording: several of
            these run at once, and pointing them at four-minute files would
            pull hundreds of megabytes through the page. */}
        {showVideo && (
          <LoopingPreview
            src={src!}
            poster={poster}
            className="absolute inset-0 h-full w-full object-cover"
            objectPosition={CROP}
          />
        )}

        {/* The rest state, as an overlay rather than a `filter: brightness()`.
            Compositing one flat layer is far cheaper than filtering every card
            in a strip that is moving the whole time. */}
        <div
          className="pointer-events-none absolute inset-0 bg-void"
          style={{ transition: 'opacity 600ms', opacity: hover ? 0 : 0.12 }}
        />

        {/* A light raking across the face, brightest at the top left. Fixed to
            the card rather than to the screen, so a card turning through the
            middle of the strip catches it at an angle — which is most of what
            makes the pose read as a surface rather than a picture. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03) 32%, transparent 55%)',
            mixBlendMode: 'overlay',
          }}
        />

        {/* Sized and weighted for the brightest thing in the archive: a hall
            full of choir robes under white stage wash, which a lighter
            gradient left the caption sitting invisibly on top of. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4) 40%, transparent)',
          }}
        />

        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <p className="label on-scrim mb-2.5 text-white/50">{piece.meta}</p>
          <h3 className="tracked-tight on-scrim text-[clamp(0.78rem,1.05vw,1.05rem)] leading-snug text-white">
            {piece.title}
          </h3>
        </div>
      </button>
    </li>
  )
})
