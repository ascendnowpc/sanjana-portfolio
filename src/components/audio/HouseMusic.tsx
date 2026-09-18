import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { mediaUrl } from '@/lib/media'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

interface Props {
  /** The recording to play, as a media key ("/media/audio/x.mp3"). */
  src: string
  /** What the control names, so the visitor knows what they are hearing. */
  title: string
  /** Seconds into the recording the excerpt starts. */
  from?: number
  /** Seconds into the recording the excerpt ends. Omit to play to the end. */
  to?: number
}

/** Target level. Well under unity — this plays under a page, not at it. */
const LEVEL = 0.5
/** Seconds the level takes to arrive, and to leave. */
const FADE = 1.6

/**
 * How a visitor's choice is remembered.
 *
 * `sessionStorage`, not `localStorage`: silencing the index should hold for
 * the visit, and a return weeks later should sound again rather than being
 * permanently mute for reasons nobody remembers. Wrapped because it throws
 * outright in a locked-down browser.
 */
const MUTED_KEY = 'house-music-muted'
const wasMuted = () => {
  try {
    return sessionStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}
const rememberMuted = (muted: boolean) => {
  try {
    sessionStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  } catch {
    /* private mode, blocked storage — the visit just does not carry over */
  }
}

/**
 * The first thing the index plays: one recording, under the room.
 *
 * Every browser refuses audible playback until the visitor has done
 * something, and the refusal is a rejected promise rather than an error, so
 * there is nothing to catch centrally. This handles both outcomes: it asks
 * once on mount, and if it is turned down it arms a one-shot listener and
 * starts on the first pointer, key, wheel or touch — which on this page is
 * the move of the cursor that turns the room, i.e. immediately.
 *
 * The level is faded rather than switched. Audio that arrives at full level
 * reads as a mistake to be silenced; audio that comes up over a second and a
 * half reads as part of the room, which is the whole point of house music.
 *
 * Nothing here loops. One take plays, ends, and the control says so — the
 * index does not become a thing that hums at you indefinitely.
 */
export function HouseMusic({ src, title, from = 0, to }: Props) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef<number | null>(null)

  const [muted, setMuted] = useState(wasMuted)
  /**
   * The same answer as `muted`, readable synchronously.
   *
   * `play()` resolves a turn or two after it is called, and the click that
   * silences the control is also a gesture that can arm a start — so by the
   * time a play promise lands the visitor may already have said no. State read
   * inside that callback would be the state from before the click; this is not.
   */
  const mutedRef = useRef(muted)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  /** A missing or undecodable file takes the control off the page entirely. */
  const [broken, setBroken] = useState(false)

  /** Ramps the element's own volume; `setTimeout` is plenty at this rate. */
  const fadeTo = useCallback((target: number, seconds: number) => {
    const el = ref.current
    if (!el) return
    if (fadeRef.current) window.clearInterval(fadeRef.current)
    const step = 40
    const delta = (target - el.volume) / ((seconds * 1000) / step)
    fadeRef.current = window.setInterval(() => {
      const next = el.volume + delta
      if ((delta > 0 && next >= target) || (delta <= 0 && next <= target)) {
        el.volume = target
        if (fadeRef.current) window.clearInterval(fadeRef.current)
        fadeRef.current = null
        if (target === 0) el.pause()
      } else {
        el.volume = Math.min(1, Math.max(0, next))
      }
    }, step)
  }, [])

  const start = useCallback(() => {
    const el = ref.current
    if (!el || el.ended || mutedRef.current) {
      return Promise.reject(new Error('nothing to start'))
    }
    el.volume = 0
    return el.play().then(() => {
      if (mutedRef.current) {
        el.pause()
        return
      }
      setPlaying(true)
      fadeTo(LEVEL, FADE)
    })
  }, [fadeTo])

  /* Open, or wait for the gesture that lets us. */
  useEffect(() => {
    if (muted || ended || broken) return
    let armed = false
    const onGesture = () => {
      start().catch(() => {})
    }
    const arm = () => {
      if (armed) return
      armed = true
      const opts = { once: true, passive: true } as const
      window.addEventListener('pointerdown', onGesture, opts)
      window.addEventListener('pointermove', onGesture, opts)
      window.addEventListener('keydown', onGesture, opts)
      window.addEventListener('wheel', onGesture, opts)
      window.addEventListener('touchstart', onGesture, opts)
    }
    start().catch(arm)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('pointermove', onGesture)
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('wheel', onGesture)
      window.removeEventListener('touchstart', onGesture)
    }
  }, [muted, ended, broken, start])

  /* Leaving the index takes the sound with it. */
  useEffect(() => {
    const el = ref.current
    return () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current)
      el?.pause()
    }
  }, [])

  const toggle = () => {
    const next = !muted
    mutedRef.current = next
    setMuted(next)
    rememberMuted(next)
    if (next) {
      setPlaying(false)
      fadeTo(0, 0.5)
    } else {
      setEnded(false)
      start().catch(() => {})
    }
  }

  if (broken) return null

  return (
    <div className="pointer-events-none absolute bottom-10 left-6 z-10 md:bottom-14 md:left-12">
      <audio
        ref={ref}
        src={mediaUrl(src)}
        preload="auto"
        onLoadedMetadata={() => {
          const el = ref.current
          if (el && from) el.currentTime = from
        }}
        onTimeUpdate={() => {
          const el = ref.current
          if (!el || to === undefined || el.currentTime < to) return
          el.pause()
          setPlaying(false)
          setEnded(true)
        }}
        onEnded={() => {
          setPlaying(false)
          setEnded(true)
        }}
        onError={() => setBroken(true)}
      />

      <button
        type="button"
        onClick={toggle}
        className="group pointer-events-auto flex items-center gap-3 text-left"
        aria-label={
          muted || !playing ? `Play ${title}` : `Stop playing ${title}`
        }
      >
        {/* Three bars, lit and moving only while something is sounding —
            so the control reads as a state before it reads as a label. */}
        <span className="flex h-4 items-end gap-[3px]">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className={playing ? 'w-[2px] bg-gilt' : 'w-[2px] bg-dust'}
              initial={false}
              animate={
                playing && !reduced
                  ? { height: ['30%', '100%', '55%', '85%', '30%'] }
                  : { height: playing ? '60%' : '30%' }
              }
              transition={
                playing && !reduced
                  ? {
                      duration: 1.5 + i * 0.35,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
                  : { duration: 0.3 }
              }
              style={{ height: '30%' }}
            />
          ))}
        </span>

        <span className="label on-scrim text-dust transition-colors duration-300 group-hover:text-mist">
          {playing ? (
            <span className="text-mist">{title}</span>
          ) : ended && !muted ? (
            `Play again — ${title}`
          ) : (
            `Sound — ${title}`
          )}
        </span>
      </button>
    </div>
  )
}
