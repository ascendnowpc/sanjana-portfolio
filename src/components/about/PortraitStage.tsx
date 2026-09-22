import { useCallback, useEffect, useRef, useState } from 'react'
import { useScroll, useSpring } from 'framer-motion'
import { PORTRAIT, PROFILE } from '@/data/site'
import { Reveal } from '@/components/ui/Reveal'
import { useMediaQuery, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

/**
 * The piece on the stage, as a frame sequence rather than a film.
 *
 * A hundred stills of the whole ten-second clip, drawn one at a time against
 * the scroll. That is the whole reason it is not a `<video>`: a film plays at
 * its own speed, and this column is supposed to play at the reader's — the
 * same thing the 3D scan that stood here before it did. A video element can be
 * seeked, but seeking one per scroll event asks the decoder for a keyframe it
 * usually has to walk to, and the result stutters exactly when the reader is
 * paying most attention to it.
 *
 * A hundred steps over the section's seventeen hundred pixels of scroll is a
 * frame every seventeen, which is what the sequence is sampled at rather than
 * at the clip's own rate. Sampling every third frame of the thirty a second is
 * not a loss here: nothing plays, so the only rate that matters is how much
 * scroll sits between one frame and the next, and by that measure this is
 * smoother than the shorter run it replaces even though it covers four times
 * as much of the clip.
 *
 * The frames carry a real alpha channel. The source arrives with its
 * background already lifted to a flat white, and white is not transparent on a
 * black page — but a flat ground keys far more accurately than a segmentation
 * model guesses, so the matte is cut from it rather than inferred. What makes
 * it safe is that the ground is found by what it is *connected to* rather than
 * by its colour: the mic's chrome has near-white highlights of its own, and
 * keying on whiteness alone punches holes straight through the grille.
 *
 * Transparency rather than `mix-blend-mode: screen` over a black-composited
 * clip, which is what an earlier cut did. The blend was never reliable —
 * Safari routinely gives an element its own compositing layer and skips it,
 * leaving a black rectangle on the page. There is nothing to skip now: the
 * surround is absent, not cancelled.
 *
 * At the root of public/ and deliberately NOT run through `mediaUrl`, which is
 * where the 3D scan sat and for the same reason: everything under
 * public/media/ is rewritten to the R2 bucket whenever VITE_R2_PUBLIC_URL is
 * set, so an asset filed there has to be uploaded separately before it exists
 * in production. The section has no picture at all without these, so they ship
 * with the build, where they cannot fall out of step with the code.
 *
 * All hundred together come to 1.7 MB, against the 1.5 MB the scan and its
 * renderer cost between them.
 */
const FRAME_COUNT = 100
const frameSrc = (i: number) =>
  `/mic-frames/mic-${String(i).padStart(3, '0')}.webp`

/**
 * The frames' own pixel size, which is also the canvas's.
 *
 * Fixed rather than measured, so the canvas never needs resizing and a window
 * drag never costs a redraw. Every frame was cropped to one box — the union of
 * the subject across the whole run, not each frame's own bounds, or the mic
 * would walk around inside its own frame as it moved — so they are all exactly
 * this, and CSS scales the result down into the column.
 *
 * The box is wider than the mic needs for most of the run because the clip
 * turns the mic on its side in the middle of it, and a box that holds the
 * turn holds everything. The rest of the run simply carries transparent air
 * either side, which costs almost nothing to encode and nothing to draw.
 */
const FRAME_W = 381
const FRAME_H = 760

/**
 * How much of the column the piece is drawn at, as a fraction of its height.
 *
 * Kept apart from the scroll below for the same reason the 3D stage kept its
 * framing box apart from its dolly: this is the size of the subject in the
 * column, and the scroll is what moves it. Fold the two together and there is
 * no longer a number that answers "how big should the mic be".
 *
 * The mic in these frames has no bottom — the stand runs out of the source
 * frame throughout, so there is no size at which all of it is on screen.
 * Drawn large that reads as a clipped video; drawn small, with the fade below
 * taking the last of the stand, it reads as a mic standing in a dark room,
 * which is the picture the section wants anyway.
 */
const FILM_HEIGHT = 0.62

/**
 * The bottom edge, softened.
 *
 * The stand leaves the bottom of the frame rather than ending inside it, so
 * without this there is a hard horizontal line where it stops — the one thing
 * that gives away there is a rectangle there at all. Fading the last fifth
 * lets it run out of light instead of into an edge. At the near end of the
 * push-in the mask is doing real work; at the far end the stand stops well
 * short of it and it does nothing.
 */
const EDGE_FADE = 'linear-gradient(to bottom, #000 80%, transparent 99%)'

/** The frame a reader who has asked for no motion is shown, held still. */
const STILL = 0.42

type Stage = 'idle' | 'loading' | 'ready' | 'failed'

/**
 * The portrait section: the piece on one side, the bio down the other.
 *
 * The whole point of the layout is that the two are read *together*. The
 * column is pinned for the length of the prose, so the reader is never
 * choosing between the words and the picture — the picture is simply still
 * there, turning, for as long as there is text to the left of it. That is the
 * one thing a video of a turntable cannot do, because a video plays at its own
 * speed and this plays at the reader's.
 *
 * The sequence is not decoration that happens to move, and it is not loaded
 * like decoration either. A megabyte and a half is a real cost, so it is spent
 * only when two things hold: the reader is within a screen of the section, and
 * they have not asked their browser to save data. When either fails the column
 * shows a portrait instead and the section reads exactly the same — the words
 * were never waiting on the picture.
 */
export function PortraitStage() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const isDesktop = useMediaQuery('(min-width: 768px)')
  const reduced = usePrefersReducedMotion()

  const [stage, setStage] = useState<Stage>('idle')
  const [loaded, setLoaded] = useState(0)

  /** The decoded frames, and the blended position currently on the canvas. */
  const frames = useRef<(HTMLImageElement | undefined)[]>([])
  const drawn = useRef(-1)

  /**
   * The nearest frame to `i` that has actually arrived.
   *
   * The sequence paints from the first response rather than the last, so for
   * the first second or so of loading most of the array is still empty.
   * Searching outward means an early scroll shows the closest picture there is
   * instead of nothing at all, and the run fills in underneath it.
   */
  const nearest = useCallback((i: number) => {
    for (let d = 0; d < FRAME_COUNT; d++) {
      if (frames.current[i - d]) return frames.current[i - d]
      if (frames.current[i + d]) return frames.current[i + d]
    }
    return undefined
  }, [])

  /**
   * Put the sequence at `exact` — a position between frames, not a frame.
   *
   * The two frames either side of it are drawn, the second at the alpha of
   * whatever fraction sits between them, so the picture changes on every
   * painted frame rather than only on the ones where the rounded index
   * happens to tick over. That is the whole of the smoothness: with a hundred
   * and fifty stills over seventeen hundred pixels of scroll, rounding to the
   * nearest leaves the mic changing about twice for every three times the
   * browser paints, which is a ten-to-thirty-frames-a-second picture inside a
   * sixty-frames-a-second page. Blending fills in the between.
   *
   * It is a dissolve rather than a true interpolation — nothing here invents a
   * position the clip never held — so on the fastest part of the turn the two
   * are briefly visible at once. At this spacing that reads as motion blur,
   * which is what a real camera would have put there anyway.
   */
  const drawAt = useCallback(
    (exact: number) => {
      const clamped = Math.max(0, Math.min(FRAME_COUNT - 1, exact))
      const first = Math.floor(clamped)
      const blend = clamped - first
      // Quantised before the equality check, or a spring that is still
      // settling by thousandths redraws forever after the picture has stopped
      // visibly changing.
      const key = first * 64 + Math.round(blend * 63)
      if (key === drawn.current) return

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      const a = nearest(first)
      if (!a) return

      ctx.clearRect(0, 0, FRAME_W, FRAME_H)
      ctx.globalAlpha = 1
      ctx.drawImage(a, 0, 0, FRAME_W, FRAME_H)
      if (blend > 0) {
        // The exact neighbour, not the nearest one. Mid-load the frame after
        // this may not have arrived, and dissolving towards whatever *has*
        // would blend across a gap of ten frames and read as a flicker. No
        // neighbour simply means no blend until it lands.
        const b = frames.current[first + 1]
        if (b && b !== a) {
          ctx.globalAlpha = blend
          ctx.drawImage(b, 0, 0, FRAME_W, FRAME_H)
          ctx.globalAlpha = 1
        }
      }
      drawn.current = key
    },
    [nearest],
  )

  /* ---------------- when the sequence is allowed to exist ----------------
     An observer a full viewport ahead of the section, so the download starts
     while the reader is still in the film above it and the piece is already
     standing there when they arrive. It fires once and then stops watching:
     this is a decision to spend the bytes, and it is not revisited. */
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection
    if (connection?.saveData === true) {
      setStage('failed')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setStage('loading')
      },
      { rootMargin: '100% 0px' },
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  /* ---------------- loading ----------------
     Sixty-one small files in flight together. They are counted rather than
     weighed — they are within a few kilobytes of each other, so a count is the
     same bar as a byte total, and it does not need every response to be
     length-computable to draw it.

     The first frame to arrive is painted immediately rather than waited on, so
     the column stops being empty at the first response instead of the last,
     and the rest of the load is the picture gaining the ability to move. */
  useEffect(() => {
    if (stage !== 'loading') return
    let cancelled = false
    let done = 0
    let failures = 0

    frames.current = new Array(FRAME_COUNT)

    for (let i = 0; i < FRAME_COUNT; i++) {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        if (cancelled) return
        // Decoded here rather than left for the first `drawImage` that wants
        // it. An <img> that has loaded has not necessarily been decoded, and
        // a decode on the drawing path happens inside the scroll handler,
        // which is the one place in this component that must never block.
        // `decode()` is advisory and can reject on a detached image, so a
        // failure just means the old behaviour rather than a broken frame.
        void image.decode().catch(() => {})
        frames.current[i] = image
        done++
        setLoaded(done / FRAME_COUNT)
        // Whatever turned up first, so the wait is a picture rather than a
        // hole. The usual guard is bypassed only because the canvas is still
        // empty; every later draw goes through it.
        if (drawn.current === -1) drawAt(i)
        if (done + failures === FRAME_COUNT) setStage('ready')
      }
      image.onerror = () => {
        if (cancelled) return
        failures++
        // One missing frame is a hole the scroll passes over without anyone
        // noticing; a sequence that did not arrive at all is a section with no
        // picture in it, and that is what the photograph is for.
        if (failures === FRAME_COUNT) setStage('failed')
        else if (done + failures === FRAME_COUNT) setStage('ready')
      }
      image.src = frameSrc(i)
    }

    return () => {
      cancelled = true
    }
  }, [stage, drawAt])

  /* ---------------- what the scroll means ----------------
     Two readings of the same scroll, because the column behaves differently
     at the two widths. Pinned, the section's own start-to-end *is* the length
     of the move. Stacked, the stage scrolls past like anything else, so the
     move is spread over its transit of the viewport instead. */
  const pinned = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })
  const passing = useScroll({
    target: stageRef,
    offset: ['start end', 'end start'],
  })
  const scrolled = useSpring(
    isDesktop ? pinned.scrollYProgress : passing.scrollYProgress,
    { stiffness: 80, damping: 26, mass: 0.6 },
  )

  /* ---------------- the move ----------------
     The scroll position, drawn. Nothing here touches React: the subscription
     writes to a ref and the canvas is painted from it, so a scroll never
     causes a render.

     The draw is deferred to an animation frame rather than run inside the
     spring's callback, and at most one is scheduled at a time. A spring can
     emit more than once between two paints, and drawing on each of those is
     work the screen never shows; this way the picture is computed once per
     frame the browser is actually going to paint, which is also the only
     cadence at which the blend above means anything.

     A reader who has asked for no motion gets one frame and no subscription.
     A still frame is a photograph, and there is nothing about a photograph to
     object to — they get the best single frame of the run rather than being
     stranded at the top of a move they will never see the rest of. */
  useEffect(() => {
    if (stage === 'idle' || stage === 'failed') return
    if (reduced) {
      drawAt(STILL * (FRAME_COUNT - 1))
      return
    }

    let raf = 0
    let want = scrolled.get() * (FRAME_COUNT - 1)
    drawAt(want)

    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        drawAt(want)
      })
    }

    const unsubscribe = scrolled.on('change', (v) => {
      want = v * (FRAME_COUNT - 1)
      schedule()
    })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      unsubscribe()
    }
  }, [stage, reduced, scrolled, drawAt])

  const fallback = mediaUrl(PROFILE.portraits[0])

  return (
    <section ref={sectionRef} className="relative">
      <div className="mx-auto grid max-w-[1600px] px-6 md:grid-cols-[46fr_54fr] md:gap-16 md:px-12">
        {/* ---------------- the stage ---------------- */}
        <div className="md:col-start-2 md:row-start-1">
          <div
            ref={stageRef}
            className="relative h-[62vh] min-h-[380px] md:sticky md:top-0 md:h-screen"
          >
            {/* The pool of light the mic sits *against*. On a flat black
                ground with no horizon a lit object has nothing behind it and
                reads as cut out and pasted on — which, here, it literally is.
                The page's own starfield shows through from behind; this
                section paints no ground of its own precisely so that it can,
                and the frames' transparency is what lets it. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(52% 42% at 50% 60%, rgba(255,255,255,0.07), transparent 72%)',
              }}
            />

            {stage === 'failed' ? (
              <img
                src={fallback}
                alt={`${PROFILE.name} — portrait`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover grayscale-[35%] md:inset-y-[12%] md:h-[76%]"
              />
            ) : (
              <canvas
                ref={canvasRef}
                width={FRAME_W}
                height={FRAME_H}
                aria-hidden="true"
                // Height drives the size and the width follows the frames' own
                // ratio, so the piece keeps its proportions at every column
                // width without the canvas ever being re-measured.
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  height: `${FILM_HEIGHT * 100}%`,
                  width: 'auto',
                  maskImage: EDGE_FADE,
                  WebkitMaskImage: EDGE_FADE,
                }}
              />
            )}

            {/* The wait, which is measured rather than spun. A bar that is
                visibly moving reads as a download, which is what it is, and it
                degrades honestly: on a fast line the frames are here before it
                has anything to say and it never appears. */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center transition-opacity duration-700 md:bottom-16"
              style={{ opacity: stage === 'loading' ? 1 : 0 }}
            >
              <div className="w-40">
                <div className="h-px w-full bg-edge">
                  <div
                    className="h-px bg-bloom transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.round(loaded * 100)}%` }}
                  />
                </div>
                <p className="mono-label mt-3 text-center text-[0.5625rem] text-dust">
                  Loading portrait — {Math.round(loaded * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- the words ---------------- */}
        <div className="md:col-start-1 md:row-start-1">
          <div className="py-20 md:py-[38vh]">
            <Reveal>
              <p className="label text-dust">Portrait</p>
              {/* No display headline here any more. The section used to open
                  on one, and the lead now carries the section by itself —
                  first person, and the first thing read on the page. */}
              <p className="mt-8 max-w-[46ch] text-lg leading-[1.7] font-light text-mist">
                {PORTRAIT.lead}
              </p>
            </Reveal>

            <div className="mt-24 space-y-20 md:mt-32 md:space-y-[20vh]">
              {PORTRAIT.beats.map((beat) => (
                <Reveal key={beat.accent}>
                  <h3 className="mono-label text-xs text-chalk">
                    {beat.heading}{' '}
                    {/* Reversed out rather than coloured in. The reference
                        does this with a highlighter; there is no second
                        colour on this site to do it with, and white on the
                        black ground is the same gesture at full strength. */}
                    <span className="bg-bloom px-1.5 py-0.5 text-void">
                      {beat.accent}
                    </span>
                  </h3>
                  <p className="mt-6 max-w-[46ch] leading-[1.75] font-light text-mist">
                    {beat.body}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
