import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { PORTRAIT, PROFILE } from '@/data/site'
import { Reveal } from '@/components/ui/Reveal'
import { useMediaQuery, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

/**
 * The loop that stands on the stage, and the frame it is held on until it runs.
 *
 * The size is in the key, like every other media file here: R2 objects carry
 * an immutable one-year cache header, so a re-cut has to land under a new name
 * or the edge keeps serving the old one.
 *
 * Two encodings of the same cut rather than one. The `.webm` is the smaller
 * file and the `.mp4` is the one that plays everywhere, and a `<source>` list
 * costs nothing — the browser picks one and downloads only that.
 */
const LOOP_WEBM = '/media/video/mic-loop-720.webm'
const LOOP_MP4 = '/media/video/mic-loop-720.mp4'
const LOOP_POSTER = '/media/posters/mic-loop.jpg'

/**
 * How the surround is got rid of.
 *
 * The cut-out is composited onto true black in the file itself rather than
 * carried as an alpha channel, and `screen` is what turns that back into
 * transparency in the page: black is the identity for the blend, so every
 * pixel of the surround leaves whatever is behind it exactly as it was, and
 * the page's own starfield shows through the frame instead of being punched
 * out by a black rectangle.
 *
 * It is done this way because transparent video has no format that plays
 * everywhere. WebM's alpha channel is ignored by Safari, and the HEVC
 * alternative can only be *encoded* on macOS. Both of those are real
 * constraints on a site that has to run on a phone; a blend mode is not.
 *
 * The one thing it costs is that the film can only ever be lighter than what
 * it sits on. On this page the ground is #000 and the subject is chrome, so
 * that is the whole of the picture anyway.
 */
const BLEND = 'screen' as const

/**
 * The bottom edge of the film, softened.
 *
 * At the near end of the push-in the stand runs out of the bottom of the
 * source frame, so there is a hard horizontal line where it stops. On a page
 * with no visible frame around the film that line is the only thing that gives
 * away there is a rectangle there at all, and it reads as a clipped video
 * rather than as a crop.
 *
 * Fading the last fifth costs nothing to do and nothing to look at: under
 * `screen` black is already invisible, so a mask to transparent and a fade to
 * black are the same picture, and the stand simply runs out of light instead
 * of running into an edge. At the far end of the loop the stand stops well
 * short of here and the mask does nothing at all.
 */
const EDGE_FADE = 'linear-gradient(to bottom, #000 80%, transparent 99%)' 

/**
 * How much of the column the film is drawn at, as a fraction of its height.
 *
 * Kept apart from the scroll move below for the same reason the 3D stage kept
 * its framing box apart from its dolly: this is the size of the subject in the
 * column, and the move is a modulation of it. Fold the two together and there
 * is no longer a number that answers "how big should the mic be".
 *
 * The film is a push-in, so the mic is not one size in it — even over the
 * widest stretch of the source it grows by half again. 0.62 is set off the
 * *closest* end of that, which is the one that can crowd the column, and it
 * leaves the far end sitting small with air around it.
 *
 * Lower than the 3D piece this replaced sat at, and deliberately. That piece
 * was a whole object: it ended in a weighted base and the frame could be cut
 * to it. The mic in this film has no bottom — the stand runs out of the source
 * frame in every one of its frames, at every zoom, so there is no size at
 * which all of it is on screen. Drawn large, that reads as a clipped video.
 * Drawn small, with the fade above taking the last of the stand, it reads as a
 * mic standing in a dark room, which is the picture the section wants anyway.
 */
const FILM_HEIGHT = 0.62

/** The pose a reader who has asked for no motion gets, held still. */
const STILL_SCALE = 1.02

/**
 * The portrait section: the loop on one side, the bio down the other.
 *
 * The whole point of the layout is that the two are read *together*. The film
 * column is pinned for the length of the prose, so the reader is never
 * choosing between the words and the picture — the picture is simply still
 * there, turning, for as long as there is text to the left of it.
 *
 * This column held a scroll-driven 3D scan before the film, and the swap gives
 * up one real thing: a model played at the reader's speed, and a film plays at
 * its own. What is kept is the response — the frame still answers the scroll,
 * by easing through a few percent of scale across the section, so the column
 * reads as something the reader is moving through rather than a clip pasted
 * into a pinned box. It is deliberately small. A film that is also being
 * pushed and pulled hard has two motions in it fighting for the same eye.
 *
 * The film is not decoration that happens to move, and it is not loaded like
 * decoration either. Just over a megabyte is a real cost, so it is spent only
 * when two things hold: the reader is within a screen of the section, and they
 * have not asked their browser to save data. When either fails the column
 * shows a portrait instead and the section reads exactly the same — the words
 * were never waiting on the film.
 */
export function PortraitStage() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const isDesktop = useMediaQuery('(min-width: 768px)')
  const reduced = usePrefersReducedMotion()

  // Whether the bytes have been committed to, and whether they arrived.
  const [wanted, setWanted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  /* ---------------- when the film is allowed to exist ----------------
     An observer a full viewport ahead of the section, so the download starts
     while the reader is still in the film above it and the loop is already
     running when they arrive. It fires once and then stops watching: this is
     a decision to spend the bytes, and it is not revisited. */
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection
    if (connection?.saveData === true) {
      setFailed(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setWanted(true)
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

  // Closest at the middle beat, a little back at both ends, which is the shape
  // the 3D move had: the reader arrives, the shot closes in, the shot opens
  // out again. A section with a centre, rather than one long push that has to
  // stop somewhere arbitrary.
  const scale = useTransform(scrolled, [0, 0.45, 1], [0.99, 1.05, 0.98])

  /* ---------------- playback ----------------
     Muted autoplay is granted rather than guaranteed, and the grant is
     withdrawn in a few real cases — a phone in low-power mode is the common
     one. So the play attempt is made explicitly and its failure is handled:
     the poster stays up and the section is a photograph, which is a picture
     the page is perfectly happy to be. */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !wanted || reduced) return
    video.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    )
  }, [wanted, reduced])

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
                and so that the blend above has something to show through to. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(52% 42% at 50% 60%, rgba(255,255,255,0.07), transparent 72%)',
              }}
            />

            {failed ? (
              <img
                src={fallback}
                alt={`${PROFILE.name} — portrait`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover grayscale-[35%] md:inset-y-[12%] md:h-[76%]"
              />
            ) : (
              <motion.div
                className="absolute inset-x-0 top-1/2"
                style={{
                  height: `${FILM_HEIGHT * 100}%`,
                  y: '-50%',
                  scale: reduced ? STILL_SCALE : scale,
                }}
              >
                <video
                  ref={videoRef}
                  poster={mediaUrl(LOOP_POSTER)}
                  // Not `autoPlay`: the element is mounted before the reader is
                  // anywhere near it, and autoplay would start the download at
                  // the top of the page. Playback is asked for above, once the
                  // observer has decided the bytes are worth spending.
                  loop
                  muted
                  playsInline
                  preload={wanted ? 'auto' : 'none'}
                  // A still frame of a mic is a photograph, and there is
                  // nothing about a photograph for a reader who has asked for
                  // no motion to object to. They get the poster, held.
                  onError={() => setFailed(true)}
                  className="h-full w-full object-contain"
                  style={{
                    mixBlendMode: BLEND,
                    maskImage: EDGE_FADE,
                    WebkitMaskImage: EDGE_FADE,
                  }}
                  aria-hidden="true"
                >
                  {wanted && !reduced && (
                    <>
                      <source src={mediaUrl(LOOP_WEBM)} type="video/webm" />
                      <source src={mediaUrl(LOOP_MP4)} type="video/mp4" />
                    </>
                  )}
                </video>
              </motion.div>
            )}

            {/* The wait, which is a fade rather than a bar. The poster is the
                film's own first frame, so there is no moment where the column
                is empty and nothing to measure the wait against: the picture
                is already the right picture, and the only thing that changes
                when the file lands is that it starts moving. */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center transition-opacity duration-700 md:bottom-16"
              style={{ opacity: wanted && !playing && !reduced && !failed ? 1 : 0 }}
            >
              <p className="mono-label text-[0.5625rem] text-dust">Loading portrait</p>
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
