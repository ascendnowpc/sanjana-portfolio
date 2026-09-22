import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useMotionValue, useScroll, useSpring } from 'framer-motion'
import type { Framing, Piece, Pose } from '@/components/three/ModelStage'
import { PORTRAIT, PROFILE } from '@/data/site'
import { Reveal } from '@/components/ui/Reveal'
import { useMediaQuery, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

/**
 * three.js and the loader are the whole of this chunk, and neither is on any
 * other page. Split so the About route's own JS stays the size it was and the
 * reader only pays for a renderer once they are on their way to seeing one.
 */
const ModelStage = lazy(() => import('@/components/three/ModelStage'))

/**
 * What stands on the stage.
 *
 * One piece: `mic.glb`, the Shure 55 on its desk stand, alone. It is a single
 * static mesh with no skeleton, so nothing here is posed; the mic simply
 * stands and the room turns around it.
 *
 * It is the piece the stage is sized by, so its height is the stage unit and
 * is left at 1. Everything about how large it reads is therefore in FRAMING
 * below rather than here: shrinking the box the camera has to hold is what
 * fills the column, and it keeps the one object centred on the turn axis
 * instead of orbiting an axis it does not sit on.
 *
 * The rotation is the only composition left, and it is a few degrees of turn
 * and nothing else. An object on a round weighted base is not a thing that
 * leans — any lean at all reads as a mic about to go over — so the piece is
 * turned a little off square, to take the museum-exhibit stiffness out of it,
 * and left upright.
 *
 * Not run through `mediaUrl`: it sits at the root of public/, outside the
 * public/media/ tree that scripts/upload-media.mjs mirrors into R2, so the
 * bucket has no such key.
 */
const PIECES: Piece[] = [
  {
    src: '/mic.glb',
    rotation: [0, 0.1, 0],
  },
]

/**
 * The move, read down the page.
 *
 * It stays inside about sixty degrees of front on purpose. The grille is the
 * face of this object — the ribbed chrome fan is the whole reason a Shure 55
 * is recognisable — and the back of it is a plain shell, which is where a full
 * turntable spends a third of its time. So the run opens on one side, crosses
 * the grille square-on around the second beat, and finishes on the other with
 * the eye dropped to just under the head.
 *
 * The dolly is not monotonic either. Pulling back a little at both ends and
 * sitting closest at the middle beat gives the section a centre — the reader
 * arrives, the shot closes in, the shot opens out again — instead of one long
 * uninterrupted push that has to stop somewhere arbitrary.
 */
const POSES: Pose[] = [
  { at: 0, yaw: 0.52, elevation: 0.13, dolly: 1.06, lift: 0.02 },
  { at: 0.45, yaw: 0.03, elevation: 0.06, dolly: 0.94, lift: 0.0 },
  { at: 1, yaw: -0.55, elevation: -0.03, dolly: 1.03, lift: -0.03 },
]

/**
 * Tall and narrow, because the piece is.
 *
 * The box is what the camera must hold, in stage units, and the piece on it is
 * one unit tall by definition. This one is genuinely a tall thin object: the
 * mic and its stand are 0.47 wide and 0.47 deep for their one of height, and
 * near enough rotationally symmetric that the silhouette barely changes width
 * through the sweep. The stage held a wide seated scan before this, 1.36
 * across, and the box was opened up to 0.7 to hold it — left alone that would
 * now frame a column of empty stage with a mic somewhere in the middle of it.
 *
 * So the height is what the fit is governed by again. A portrait column has an
 * aspect under 1 and `fit` takes the worse of the two axes, so the horizontal
 * term only wins once the column is narrower than about half its height; at
 * 0.3 against 0.64 the vertical term carries every width this column is laid
 * out at, and the piece reads full height with a little air top and bottom.
 *
 * 0.64 rather than a flat 0.5 because the box is the *nominal* one and the
 * move does not sit at nominal: the middle beat dollies in to 0.94, which is
 * the shot the framing has to survive, and the ends lift the aim by a few
 * hundredths on top of that. A box cut to the model exactly loses the top of
 * the grille and the front of the base at that beat.
 */
const FRAMING: Framing = {
  halfWidth: 0.3,
  halfHeight: 0.64,
  // Centred. The aim only ever trucked across to sit over a pair; with one
  // object on the turn axis, the turn axis is the middle of the picture.
  aim: { x: 0, y: 0 },
}

/** The pose a reader who has asked for no motion gets, held still. */
const STILL = 0.42

type Stage = 'idle' | 'loading' | 'ready' | 'failed'

/** Whether this browser can give us a context at all. */
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Whether the reader has told their browser not to spend their data. */
function saveData() {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  return connection?.saveData === true
}

/**
 * The portrait section: the scan on one side, the bio down the other.
 *
 * The whole point of the layout is that the two are read *together*. The model
 * column is pinned for the length of the prose, so the reader is never
 * choosing between the words and the picture — the picture is simply still
 * there, turning, for as long as there is text to the left of it. That is the
 * one thing a video of a turntable cannot do, because a video plays at its own
 * speed and this plays at the reader's.
 *
 * The model is not decoration that happens to be 3D, and it is not loaded like
 * decoration either. A megabyte of mesh plus a renderer is a real cost, so it
 * is spent only when three things hold: the reader is within a screen of the
 * section, the browser can actually draw it, and they have not asked their
 * browser to save data. When any of those fails the column shows a portrait
 * instead and the section reads exactly the same — the words were never
 * waiting on the renderer.
 */
export function PortraitStage() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const isDesktop = useMediaQuery('(min-width: 768px)')
  const reduced = usePrefersReducedMotion()

  const [stage, setStage] = useState<Stage>('idle')
  const [loaded, setLoaded] = useState(0)

  /* ---------------- when the renderer is allowed to exist ----------------
     An observer a full viewport ahead of the section, so the download starts
     while the reader is still in the film above it and the model is already
     standing there when they arrive. It fires once and then stops watching:
     this is a decision to spend the bytes, and it is not revisited. */
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    if (!hasWebGL() || saveData()) {
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

  // One value handed to the stage, whatever is driving it.
  //
  // A reader who has asked for no motion still gets the model — a still 3D
  // frame is a photograph, and there is nothing about a photograph to object
  // to. They get it held at STILL, which is the best single frame of the run,
  // rather than stranded at the top of a move they will never see the rest
  // of. Piped through a value of our own rather than handed `scrolled` or a
  // constant by turns, because the stage subscribes to whichever value it is
  // given once, on mount, and would go on watching the wrong one if the
  // answer changed underneath it.
  const progress = useMotionValue(reduced ? STILL : scrolled.get())
  useEffect(() => {
    if (reduced) {
      progress.set(STILL)
      return
    }
    progress.set(scrolled.get())
    return scrolled.on('change', (v) => progress.set(v))
  }, [reduced, scrolled, progress])

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
            {/* The pool of light the figure sits *against*. On a flat black
                ground with no horizon a lit object has nothing behind it and
                reads as cut out and pasted on. The page's own starfield shows
                through from behind — this section paints no ground of its own
                precisely so that it can. */}
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
              <div
                className="absolute inset-0"
                // The same 35% the portraits elsewhere on the site are held
                // at. Nothing else on these pages runs at full saturation,
                // and a scan that does reads as pasted in from another site
                // rather than as this one's own photography. Applied to the
                // composited layer rather than in the render: it is a GPU
                // composite either way, and doing it here keeps the shader
                // the model shipped with.
                style={{ filter: 'grayscale(0.35)' }}
              >
                {stage !== 'idle' && (
                  <Suspense fallback={null}>
                    <ModelStage
                      pieces={PIECES}
                      progress={progress}
                      poses={POSES}
                      framing={FRAMING}
                      idle={!reduced}
                      onProgress={setLoaded}
                      onReady={() => setStage('ready')}
                      onError={() => setStage('failed')}
                    />
                  </Suspense>
                )}
              </div>
            )}

            {/* The wait, which is measured rather than spun. A bar that is
                visibly moving reads as a download, which is what it is, and it
                degrades honestly: on a fast line the piece is here before the
                bar has anything to say, and the whole thing stays invisible. */}
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
