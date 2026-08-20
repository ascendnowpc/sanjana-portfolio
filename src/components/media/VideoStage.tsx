import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { mediaUrl } from '@/lib/media'

interface Props {
  poster: string
  videoSrc?: string
  title: string
  accent: string
  /** Where the play button sends the viewer when there is no video yet. */
  fallbackHref?: string
}

/**
 * The full-bleed player at the top of a performance page.
 *
 * With `videoSrc` set it is a real video with native controls once started.
 * Without one it stays a slowly drifting still — the page is meant to be
 * complete and shippable before every piece has been cut.
 *
 * The archive mixes 16:9 stage cameras with 9:16 phone footage, so the frame
 * cannot assume a shape. It used to fill the stage with `object-cover`, which
 * meant a vertical recording was cropped down to a narrow strip of its middle
 * and the performer's head was cut off. The media is now *contained* — always
 * whole, whatever its ratio — over a blurred, dimmed copy of its own poster,
 * so the stage still reads as edge-to-edge rather than as a letterboxed
 * rectangle floating on black.
 */

/**
 * Bottom of the stage kept clear of the media, as Tailwind inset classes.
 *
 * The performance page pulls its title block up into the stage with a matching
 * negative margin. A <video> lays its native controls along the bottom of its
 * own box, so a full-height video put the scrubber, the volume and the
 * fullscreen button directly underneath that title — and the <h1> paints
 * later, so it took every one of those clicks. Only play/pause, out at the far
 * left of the bar, still worked.
 *
 * Reserving the band costs a little scale and nothing else, now that the media
 * is contained rather than cropped. Keep it deeper than the title's own pull,
 * which is `-mt-24 md:-mt-32` in WorkDetail.
 */
const CLEAR_OF_TITLE = 'bottom-28 md:bottom-40'

export function VideoStage({
  poster,
  videoSrc,
  title,
  accent,
  fallbackHref,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)

  const start = () => {
    if (!videoSrc) {
      if (fallbackHref) {
        document
          .querySelector(fallbackHref)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    setStarted(true)
    void videoRef.current?.play()
  }

  return (
    <div className="relative h-[62vh] w-full overflow-hidden bg-ink md:h-[86vh]">
      {/* Fills whatever the contained media leaves over. Scaled past the edges
          because a blur samples beyond its own box and would otherwise fade
          out to transparent at the frame's border. */}
      <img
        src={mediaUrl(poster)}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-3xl"
      />

      {/* The insets live on a plain div, never on the media itself: an
          absolutely-positioned *replaced* element with both a width and a
          top/bottom pair is over-constrained, and CSS resolves that by giving
          it its intrinsic height — a 720x1280 recording became a 3024px-tall
          element hanging off the bottom of the page. */}
      <div className={`absolute inset-x-0 top-0 ${CLEAR_OF_TITLE}`}>
        {videoSrc ? (
          <video
            ref={videoRef}
            src={mediaUrl(videoSrc)}
            poster={mediaUrl(poster)}
            controls={started}
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
            onPlay={() => setStarted(true)}
          />
        ) : (
          <motion.img
            src={mediaUrl(poster)}
            alt={title}
            className="h-full w-full object-contain"
            initial={{ scale: 1.14, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </div>

      {!started && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void via-void/25 to-void/55" />

          <button
            type="button"
            onClick={start}
            aria-label={videoSrc ? `Play ${title}` : 'Jump to the recording'}
            className={`group absolute inset-x-0 top-0 ${CLEAR_OF_TITLE} flex flex-col items-center justify-center gap-10`}
          >
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full md:h-28 md:w-28">
              <span
                className="absolute inset-0 rounded-full border transition-all duration-700 group-hover:scale-110"
                style={{ borderColor: `${accent}66` }}
              />
              <span
                className="breathe absolute inset-0 rounded-full"
                style={{ boxShadow: `0 0 70px -6px ${accent}` }}
              />
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill={accent}
                className="relative ml-1.5 transition-transform duration-500 group-hover:scale-110"
              >
                <path d="M8 5l12 7-12 7z" />
              </svg>
            </span>

            {!videoSrc && (
              <span className="rounded-full bg-void/55 px-6 py-2 text-center text-[0.68rem] tracking-[0.3em] text-mist uppercase backdrop-blur-sm">
                Footage in the edit — press play for the recording
              </span>
            )}
          </button>
        </>
      )}
    </div>
  )
}
