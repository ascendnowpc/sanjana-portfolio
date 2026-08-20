import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { mediaUrl } from '@/lib/media'

interface Props {
  poster: string
  videoSrc?: string
  title: string
  /** Optional highlight for the play control. Defaults to the site's cream. */
  accent?: string
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
 * Height of the stage.
 *
 * A band, not a full screen. The reference gives its film a modest centred
 * rectangle with black all around, which reads as a screening rather than as
 * a hero image — and the page has already said what the piece is by the time
 * you reach it.
 *
 * This also retired the bottom reserve that used to live here. That existed
 * only because the title block was dragged up over the player and its native
 * controls; with the title above the video, nothing overlaps and the controls
 * sit in clear space on their own.
 */
const STAGE = 'h-[46vh] md:h-[64vh]'

export function VideoStage({
  poster,
  videoSrc,
  title,
  accent = 'rgba(232,226,214,0.85)',
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
    <div
      className={`relative mx-auto w-full max-w-[1180px] overflow-hidden bg-ink ${STAGE}`}
    >
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
      <div className="absolute inset-0">
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
            className="group absolute inset-0 flex flex-col items-center justify-center gap-10"
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
