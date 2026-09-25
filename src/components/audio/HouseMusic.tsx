import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import { mediaUrl } from '@/lib/media'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { useMusicCopy, usePerformances, useUi } from '@/content/ContentProvider'

export interface HouseMusicHandle {
  /**
   * Start the recording now, from inside the caller's own event handler.
   *
   * The gate calls this rather than setting a prop and letting an effect pick
   * it up a render later: Safari wants `play()` in the call stack of the
   * gesture that allowed it, and a state round-trip is not that stack. It also
   * clears a silence remembered from earlier in the visit — answering the gate
   * *with sound* is a newer answer than that one.
   */
  start: () => void
  /** Take the visit's answer as silence, without anything having played. */
  silence: () => void
}

interface Props {
  /** The recording to play, as a media key ("/media/audio/x.mp3"). */
  src: string
  /**
   * Somebody else owns the first play — the sound gate, which asks before the
   * index is uncovered. While this is true nothing is attempted and no gesture
   * is listened for, because every gesture on the page belongs to the gate,
   * including the one that means *no*.
   */
  gated?: boolean
  /** Imperative start, for the gate. */
  handle?: React.Ref<HouseMusicHandle>
  /** Seconds into the recording the excerpt starts. */
  from?: number
  /** Seconds into the recording the excerpt ends. Omit to play to the end. */
  to?: number
  /** The page being read. Changing it is when media can vanish without
   *  saying so — see the ducking below. */
  route: string
  /** The visitor has answered the sound question some other way: the music
   *  started under a click, or they pressed the speaker themselves. */
  onAnswered?: () => void
}

/** Target level. Well under unity — this plays under a page, not at it. */
const LEVEL = 0.5
/** Seconds the level takes to arrive, and to leave. */
const FADE = 1.6
/** Seconds it takes to step aside for somebody else's sound. */
const DUCK_FADE = 0.6

/**
 * How a visitor's choice is remembered.
 *
 * `sessionStorage`, not `localStorage`: silencing the site should hold for
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
 * That the sound question has been put to this visitor.
 *
 * The answer itself is not kept here — it goes to the player, which already
 * owns and remembers one, so declining the gate and silencing the speaker are
 * the same fact rather than two that can disagree.
 */
const GATE_KEY = 'house-gate-asked'
const wasAsked = () => {
  try {
    return sessionStorage.getItem(GATE_KEY) === '1'
  } catch {
    return false
  }
}
const rememberAsked = () => {
  try {
    sessionStorage.setItem(GATE_KEY, '1')
  } catch {
    /* blocked storage: the question simply gets asked again next time */
  }
}

/**
 * The site's own sound: one recording, under every page.
 *
 * Mounted once, above the router's pages rather than inside one of them, so
 * moving from the index to the work or the About page does not stop it — the
 * element is never unmounted, so it never has to be restarted, and a
 * restarted recording would need a fresh gesture anyway.
 *
 * Every browser refuses audible playback until the visitor has *activated*
 * the page, and the refusal is a rejected promise rather than an error, so
 * there is nothing to catch centrally. It asks once on mount, and if it is
 * turned down it waits for the activation and asks again. What counts as
 * activation is narrower than it looks: a press, a tap or a key counts, and
 * moving the cursor, scrolling and wheeling do not. Nothing here can change
 * that; it is the browser's rule, not a setting.
 *
 * The level is faded rather than switched. Audio that arrives at full level
 * reads as a mistake to be silenced; audio that comes up over a second and a
 * half reads as part of the room.
 *
 * It loops, back to the start of the excerpt, because it is the sound of the
 * whole site now rather than of one page, and a site that goes quiet three
 * minutes in reads as broken.
 *
 * And it steps aside. The detail page has a film and a recording, the About
 * page has a shelf of players, and none of them should have to be heard over
 * this. Whenever any other audible media element on the page is playing, the
 * house music fades out, and it comes back when they stop.
 */
function HouseMusic({
  src,
  from = 0,
  to,
  gated = false,
  handle,
  route,
  onAnswered,
}: Props) {
  const reduced = usePrefersReducedMotion()
  const ui = useUi()
  const ref = useRef<HTMLAudioElement | null>(null)
  /** The control itself, so a press on it can be told from a press elsewhere. */
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fadeRef = useRef<number | null>(null)
  const onAnsweredRef = useRef(onAnswered)
  onAnsweredRef.current = onAnswered

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
  /** Another film or recording on the page is sounding. */
  const [ducked, setDucked] = useState(false)
  const duckedRef = useRef(false)
  /** A missing or undecodable file takes the control off the page entirely. */
  const [broken, setBroken] = useState(false)

  /**
   * Ramps the element's own volume; `setInterval` is plenty at this rate.
   *
   * The level is counted here rather than read back off the element, because
   * iOS ignores writes to `volume` — it always reads 1 — and a ramp that reads
   * its own progress back never arrives at silence there, so the pause at the
   * bottom of a fade-out never happened and the speaker could not stop it.
   */
  const fadeTo = useCallback((target: number, seconds: number) => {
    const el = ref.current
    if (!el) return
    if (fadeRef.current) window.clearInterval(fadeRef.current)
    const step = 40
    let level = el.volume
    const delta = (target - level) / Math.max(1, (seconds * 1000) / step)
    fadeRef.current = window.setInterval(() => {
      level += delta
      if ((delta > 0 && level >= target) || (delta <= 0 && level <= target)) {
        el.volume = target
        if (fadeRef.current) window.clearInterval(fadeRef.current)
        fadeRef.current = null
        if (target === 0) el.pause()
      } else {
        el.volume = Math.min(1, Math.max(0, level))
      }
    }, step)
  }, [])

  const start = useCallback(() => {
    const el = ref.current
    if (!el || mutedRef.current || duckedRef.current) {
      return Promise.reject(new Error('nothing to start'))
    }
    // Still sounding — part-way through a fade-out, or simply already on.
    // Turning it back up is enough; restarting it from silence would dip.
    if (!el.paused) {
      setPlaying(true)
      fadeTo(LEVEL, FADE)
      return Promise.resolve()
    }
    el.volume = 0
    return el.play().then(() => {
      if (mutedRef.current || duckedRef.current) {
        el.pause()
        return
      }
      setPlaying(true)
      fadeTo(LEVEL, FADE)
      onAnsweredRef.current?.()
    })
  }, [fadeTo])

  const answer = useCallback((silent: boolean) => {
    mutedRef.current = silent
    setMuted(silent)
    rememberMuted(silent)
  }, [])

  useImperativeHandle(
    handle,
    () => ({
      start: () => {
        answer(false)
        start().catch(() => {})
      },
      silence: () => {
        answer(true)
        setPlaying(false)
        // Nothing has sounded yet — this is an answer, not an interruption —
        // so there is nothing to fade out of. Fading here would leave a timer
        // ramping the volume of a paused element for no one.
        const el = ref.current
        if (el) {
          el.pause()
          el.volume = 0
        }
      },
    }),
    [answer, start],
  )

  /* Open, or wait for the gesture that lets us. */
  useEffect(() => {
    if (gated || muted || ducked || broken) return

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
  }, [gated, muted, ducked, broken, start])

  /**
   * Step aside for anything else that is sounding.
   *
   * Media events do not bubble, but they do pass the document on the way down,
   * so one capture listener hears every film and recording on every page.
   * Rather than keeping a tally that one missed event would put out of step,
   * each event asks the page afresh whether anything else is audible now.
   *
   * The route is in the dependencies because leaving a page is the one time a
   * playing film stops without an event anybody can hear: it is taken out of
   * the document first, and its `pause` fires on an element that is no longer
   * in it. Asking again once the new page is in place catches that.
   */
  useEffect(() => {
    const check = () => {
      const own = ref.current
      const next = Array.from(
        document.querySelectorAll<HTMLMediaElement>('audio, video'),
      ).some(
        (m) =>
          m !== own && !m.paused && !m.ended && !m.muted && m.volume > 0,
      )
      if (next === duckedRef.current) return
      duckedRef.current = next
      setDucked(next)
      if (next && own && !own.paused) {
        setPlaying(false)
        fadeTo(0, DUCK_FADE)
      }
    }
    const EVENTS = [
      'play',
      'playing',
      'pause',
      'ended',
      'volumechange',
      'emptied',
    ] as const
    EVENTS.forEach((e) => document.addEventListener(e, check, true))
    check()
    return () => {
      EVENTS.forEach((e) => document.removeEventListener(e, check, true))
    }
  }, [fadeTo, route])

  /* Only ever unmounted with the whole site, but tidy up if it is. */
  useEffect(() => {
    const el = ref.current
    return () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current)
      el?.pause()
    }
  }, [])

  /** Back to the top of the excerpt, without stopping. */
  const loop = () => {
    const el = ref.current
    if (!el) return
    el.currentTime = from
    if (el.paused && !mutedRef.current && !duckedRef.current) {
      el.play().catch(() => setPlaying(false))
    }
  }

  /**
   * What the speaker shows: whether the music is *on*.
   *
   * Sounding is on. Stepped aside for a film is on as well — it has not been
   * turned off, it is waiting, and it will come back by itself. Silent because
   * the browser has not been activated yet is off, and that matters: the
   * speaker is then an offer, and the press that takes it up is the press the
   * browser was waiting for.
   */
  const on = playing || (ducked && !muted)

  const toggle = () => {
    onAnsweredRef.current?.()
    if (on) {
      answer(true)
      setPlaying(false)
      fadeTo(0, 0.5)
      return
    }
    answer(false)
    start().catch(() => {})
  }

  if (broken) return null

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed bottom-5 left-5 z-[60] md:bottom-10 md:left-10"
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
          loop()
        }}
        onEnded={loop}
        onError={() => setBroken(true)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={on ? ui.sound.turnOff : ui.sound.turnOn}
        aria-pressed={on}
        className="group pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-void/50 text-mist backdrop-blur-sm transition-colors duration-300 hover:border-white/45 hover:text-chalk"
      >
        <svg
          className="h-[18px] w-[18px] overflow-visible"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 9.25h3.25L11.5 5v14l-4.75-4.25H3.5z" fill="currentColor" />
          {on ? (
            // Two waves, breathing while the music is actually sounding and
            // held still while it has stepped aside for something else.
            <g className={playing && !reduced ? 'speaker-waves' : undefined}>
              <path d="M15 9.2a4 4 0 0 1 0 5.6" />
              <path d="M17.8 6.5a7.8 7.8 0 0 1 0 11" />
            </g>
          ) : (
            <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
          )}
        </svg>
      </button>
    </div>
  )
}

interface HouseMusicApi {
  /** Whether the index should put the sound question before it uncovers. */
  asking: boolean
  /** The visitor's answer, called from inside their click. */
  answer: (withSound: boolean) => void
}

const HouseMusicContext = createContext<HouseMusicApi>({
  asking: false,
  answer: () => {},
})

/** The sound question, for the page that asks it. */
export const useHouseMusic = () => useContext(HouseMusicContext)

/**
 * Owns the site's music, and the question that comes before it.
 *
 * It sits above the pages so the recording carries across them, and the
 * question lives here rather than on the index for the same reason: the answer
 * belongs to the visit. The index is still the only page that *asks* — it is
 * where the site begins — but a visitor who arrived somewhere else, clicked,
 * and has been listening since has answered already, and coming to the index
 * after that should not ask them to turn on a sound that is playing.
 */
export function HouseMusicProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { items } = usePerformances()
  const { houseClip } = useMusicCopy()
  const house = items.find((p) => p.slug === houseClip.slug)
  const src = house?.tracks[0]?.audioSrc
  const handle = useRef<HouseMusicHandle>(null)

  /**
   * Read straight out of storage on the first render rather than in an
   * effect, so the gate is either painted with the page or never painted at
   * all — a panel that appears a frame after the index has is a flicker.
   */
  const [asked, setAsked] = useState(wasAsked)
  const settle = useCallback(() => {
    rememberAsked()
    setAsked(true)
  }, [])

  const answer = useCallback(
    (withSound: boolean) => {
      // Before the state change, not after: this is still inside the click,
      // and the click is the permission.
      const player = handle.current
      if (withSound) player?.start()
      else player?.silence()
      settle()
    },
    [settle],
  )

  // Only the index asks, and only when there is something to hear.
  const asking = pathname === '/' && !asked && Boolean(src)
  const api = useMemo(() => ({ asking, answer }), [asking, answer])

  return (
    <HouseMusicContext.Provider value={api}>
      {children}
      {src && (
        <HouseMusic
          handle={handle}
          gated={asking}
          src={src}
          from={houseClip.from}
          to={houseClip.to ?? undefined}
          route={pathname}
          onAnswered={settle}
        />
      )}
    </HouseMusicContext.Provider>
  )
}
