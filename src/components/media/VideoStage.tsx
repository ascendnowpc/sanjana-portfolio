import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { mediaUrl } from '@/lib/utils'

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
 */
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
      {videoSrc ? (
        <video
          ref={videoRef}
          src={mediaUrl(videoSrc)}
          poster={mediaUrl(poster)}
          controls={started}
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onPlay={() => setStarted(true)}
        />
      ) : (
        <motion.img
          src={mediaUrl(poster)}
          alt={title}
          className="h-full w-full object-cover"
          initial={{ scale: 1.14, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

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
