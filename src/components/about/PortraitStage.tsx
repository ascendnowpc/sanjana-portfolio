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
 * One scan: `guitar.glb`, the double-neck, alone. It has no skeleton — it is a
 * single fused static mesh — so nothing here is posed; the piece simply stands
 * and the room turns around it.
 *
 * It is the piece the stage is sized by, so its height is the stage unit and
 * is left at 1. Everything about how large it reads is therefore in FRAMING
 * below rather than here: shrinking the box the camera has to hold is what
 * fills the column, and it keeps the one object centred on the turn axis
 * instead of orbiting an axis it does not sit on.
 *
 * The rotation is the only composition left, and it is small on purpose. Eight
 * degrees of lean and a few of turn stop it reading as a museum exhibit stood
 * square to the room; anything more and the scroll's own sweep — which crosses
 * the front of the instrument around its second beat — never gets to show the
 * face of it.
 *
 * Not run through `mediaUrl`: it sits at the root of public/, outside the
 * public/media/ tree that scripts/upload-media.mjs mirrors into R2, so the
 * bucket has no such key.
 */
const PIECES: Piece[] = [
  {
    src: '/guitar.glb',
    rotation: [0, 0.1, -0.13],
  },
]

/**
 * The move, read down the page.
 *
 * It stays inside about sixty degrees of front on purpose. Turn an instrument
 * far enough and the shot is the back of a body and a strap button, which is a
 * worse picture than any of the three below and is where a full turntable
 * spends a third of its time. So the run opens on one side, crosses the face of
 * the necks around the second beat, and finishes on the other with the eye
 * dropped almost to the level of the body.
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
 * Tight enough that the instrument fills the column.
 *
 * The box is what the camera must hold, in stage units, and the guitar is one
 * unit tall — so a half-height of 0.56 leaves it a few percent of air top and
 * bottom and nothing else. That is the whole of the size change: with only one
 * piece left there is no pair to keep apart, and the space the second scan used
 * to take is given back to this one.
 *
 * The half-width is smaller than the half-height because the piece is far
 * taller than it is wide, and because the fit takes the *worse* of the two
 * axes — height governs at every aspect ratio the column is ever laid out at,
 * and the width is here to stop a hypothetically very short, very wide stage
 * from cropping the body. It is still stated as a fixed box rather than derived
 * from the bounding box: the silhouette breathes as the scroll turns it, and a
 * camera refitted every frame would breathe with it.
 */
const FRAMING: Framing = {
  halfWidth: 0.3,
  halfHeight: 0.56,
  // Centred now. The aim only ever trucked across to sit over the pair; with
  // one object on the turn axis, the turn axis is the middle of the picture.
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
 * decoration either. Twelve megabytes is a real cost, so it is spent only when
 * three things hold: the reader is within a screen of the section, the browser
 * can actually draw it, and they have not asked their browser to save data.
 * When any of those fails the column shows a portrait instead and the section
 * reads exactly the same — the words were never waiting on the renderer.
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

            {/* The wait, which is measured rather than spun. Twelve megabytes
                is long enough that a spinner reads as a hang; a bar that is
                visibly moving reads as a download, which is what it is. */}
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
              {/* "In the round" is the staging term before it is a description
                  of the model, and it is the honest one for this page: the
                  section is about a performer who is read from every side of
                  the room, and the column beside it is doing exactly that. */}
              <h2
                className="mt-8 font-[family-name:var(--font-display)] leading-[0.94] font-light text-chalk italic"
                style={{ fontSize: 'clamp(2.6rem, 6vw, 5.5rem)' }}
              >
                In the
                <br />
                round
              </h2>
              <p className="mt-10 max-w-[46ch] text-lg leading-[1.7] font-light text-mist">
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
