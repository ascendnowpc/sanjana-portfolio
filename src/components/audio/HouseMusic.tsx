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
 * Every browser refuses audible playback until the visitor has *activated*
 * the page, and the refusal is a rejected promise rather than an error, so
 * there is nothing to catch centrally. It asks once on mount, and if it is
 * turned down it waits for the activation and asks again.
 *
 * What counts as activation is narrower than it looks, and is the whole
 * reason this is not simply an `autoplay` attribute: a press, a tap or a key
 * counts, and moving the cursor, scrolling and wheeling do not. So this page
 * — whose one instruction is *move your cursor to look around* — can be read
 * end to end in silence. Nothing here can change that; it is the browser's
 * rule, not a setting. The control is therefore written as an offer rather
 * than as a mute button: it says *Play* until it is playing.
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
  /** The control itself, so a press on it can be told from a press elsewhere. */
  const rootRef = useRef<HTMLDivElement | null>(null)
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

    /**
     * Only events that grant user activation are here.
     *
     * `pointermove` and `wheel` were, and were worse than useless: they fire
     * within a second of arriving, `play()` is refused exactly as before, and
     * a one-shot listener has then spent itself on an attempt that could
     * never have succeeded.
     */
    const GESTURES = [
      'pointerdown',
      'pointerup',
      'click',
      'keydown',
      'touchend',
    ] as const

    // Capture phase, on the document: the gallery listens for its own drag on
    // the way up, and anything that stops propagation there would otherwise
    // take the visitor's one gesture with it.
    const opts = { capture: true, passive: true } as const
    const onGesture = (e: Event) => {
      // The control's own press is the button's business, not this listener's.
      // Left in, both fire on the same click: this one starts the recording
      // and `toggle` — reading a control that was not playing a moment ago —
      // stops it again, so the one press a visitor is most likely to make is
      // the one press that does nothing.
      if (rootRef.current?.contains(e.target as Node)) return
      start().then(release).catch(() => {})
    }
    const release = () => {
      GESTURES.forEach((g) => document.removeEventListener(g, onGesture, opts))
    }
    // Not `once`: a gesture can be refused for reasons of its own — a keydown
    // on a modifier, say — and the next one should still be allowed to try.
    const arm = () => {
      GESTURES.forEach((g) => document.addEventListener(g, onGesture, opts))
    }

    start().catch(arm)
    return release
  }, [muted, ended, broken, start])

  /* Leaving the index takes the sound with it. */
  useEffect(() => {
    const el = ref.current
    return () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current)
      el?.pause()
    }
  }, [])

  /**
   * The control, read off what is actually sounding.
   *
   * Not `!muted`: silence here has three causes — the visitor asked for it, the
   * take has finished, or the browser has not been activated yet — and only the
   * first is a mute. Toggling on `muted` made the button a stop button in all
   * three, so the press that was meant to start the recording stopped one that
   * had never begun.
   */
  const toggle = () => {
    if (playing) {
      mutedRef.current = true
      setMuted(true)
      rememberMuted(true)
      setPlaying(false)
      fadeTo(0, 0.5)
      return
    }
    mutedRef.current = false
    setMuted(false)
    rememberMuted(false)
    // A finished take has to be wound back before it can be asked to play
    // again; `ended` stays true on the element until it is.
    const el = ref.current
    if (el?.ended) el.currentTime = from
    setEnded(false)
    start().catch(() => {})
  }

  if (broken) return null

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute bottom-10 left-6 z-10 md:bottom-14 md:left-12"
    >
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
        aria-label={playing ? `Stop playing ${title}` : `Play ${title}`}
      >
        {/* Silent, it is a play triangle — the one mark every visitor already
            knows to press, which matters on a page where the sound cannot
            start until something is pressed. Sounding, it is three bars that
            move: a state rather than an instruction. */}
        {!playing && (
          <svg
            className="h-3 w-3 shrink-0 fill-dust transition-colors duration-300 group-hover:fill-bloom"
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path d="M2 1.2 10.4 6 2 10.8Z" />
          </svg>
        )}
        {playing && (
          <span className="flex h-4 items-end gap-[3px]">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-[2px] bg-gilt"
                initial={false}
                animate={
                  reduced
                    ? { height: '60%' }
                    : { height: ['30%', '100%', '55%', '85%', '30%'] }
                }
                transition={
                  reduced
                    ? { duration: 0.3 }
                    : {
                        duration: 1.5 + i * 0.35,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }
                }
                style={{ height: '30%' }}
              />
            ))}
          </span>
        )}

        <span className="label on-scrim text-dust transition-colors duration-300 group-hover:text-mist">
          {playing ? (
            <span className="text-mist">{title}</span>
          ) : ended && !muted ? (
            `Play again — ${title}`
          ) : (
            `Play — ${title}`
          )}
        </span>
      </button>
    </div>
  )
}
