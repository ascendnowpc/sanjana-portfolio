import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { mediaUrl } from '@/lib/media'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { useMusicCopy, usePerformances, useUi } from '@/content/ContentProvider'

interface Props {
  /** The recording to play, as a media key ("/media/audio/x.mp3"). */
  src: string
  /** The song's name, shown on the button while it plays. */
  title: string
  /** Seconds into the recording the excerpt starts. */
  from: number
  /** Seconds into the recording the excerpt ends. Omit to play to the end. */
  to?: number
  /** The page being read. Changing it is when media can vanish without
   *  saying so — see the ducking below. */
  route: string
}

/** Target level. Well under unity — this plays under a page, not at it. */
const LEVEL = 0.5
/** Seconds the level takes to arrive. */
const FADE = 1.2
/** Seconds it takes to leave when the visitor stops it. */
const STOP_FADE = 0.5
/** Seconds it takes to step aside for somebody else's sound. */
const DUCK_FADE = 0.6

/**
 * The site's own song, on request.
 *
 * Nothing plays when somebody arrives. It used to: the recording started under
 * the first click anywhere on the site and looped beneath every page, behind a
 * screen asking whether to turn the sound on, and that read as constant. Now a
 * button in the bottom-left corner of every page offers it — "Hear me sing" —
 * and only a press on that button starts anything.
 *
 * Mounted above the router's pages, so once it has been asked for it carries
 * on from one page to the next instead of stopping at every link.
 *
 * It plays the excerpt once and then stops, and the button goes back to
 * offering it. It is a song somebody chose to hear, not a soundtrack.
 *
 * And it steps aside. The detail page has a film and a recording, the About
 * page has a shelf of players, and none of them should have to be heard over
 * this. Whenever any other audible media element on the page is playing, the
 * song fades out, and it comes back when they stop.
 */
function HouseMusic({ src, title, from, to, route }: Props) {
  const reduced = usePrefersReducedMotion()
  const ui = useUi()
  const ref = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef<number | null>(null)

  /**
   * The visitor has asked for the song and not since stopped it.
   *
   * Kept as a ref as well as state: `play()` resolves a turn or two after it
   * is called, and by the time it lands the visitor may have pressed again.
   * State read inside that callback would be the state from before the press.
   */
  const [on, setOn] = useState(false)
  const onRef = useRef(false)
  /** Actually sounding, rather than asked for and waiting. */
  const [playing, setPlaying] = useState(false)
  /** Another film or recording on the page is sounding. */
  const duckedRef = useRef(false)
  /** A missing or undecodable file takes the button off the page entirely. */
  const [broken, setBroken] = useState(false)

  /**
   * Ramps the element's own volume; `setInterval` is plenty at this rate.
   *
   * The level is counted here rather than read back off the element, because
   * iOS ignores writes to `volume` — it always reads 1 — and a ramp that reads
   * its own progress back never arrives at silence there, so the pause at the
   * bottom of a fade-out would never happen.
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

  const setAsked = (next: boolean) => {
    onRef.current = next
    setOn(next)
  }

  /** Bring the song up — from where it was if it was stopped part-way. */
  const play = useCallback(() => {
    const el = ref.current
    if (!el) return
    // Still sounding, part-way through a fade-out: turning it back up is
    // enough, and restarting it from silence would dip.
    if (!el.paused) {
      setPlaying(true)
      fadeTo(LEVEL, FADE)
      return
    }
    el.volume = 0
    el.play()
      .then(() => {
        if (!onRef.current || duckedRef.current) {
          el.pause()
          return
        }
        setPlaying(true)
        fadeTo(LEVEL, FADE)
      })
      .catch(() => {
        // Refused or failed to load. Say so by going back to the offer
        // rather than showing a song that is not playing.
        onRef.current = false
        setOn(false)
        setPlaying(false)
      })
  }, [fadeTo])

  /** The excerpt is over: back to the start, and back to offering it. */
  const finish = () => {
    const el = ref.current
    if (fadeRef.current) window.clearInterval(fadeRef.current)
    fadeRef.current = null
    if (el) {
      el.pause()
      el.currentTime = from
    }
    setAsked(false)
    setPlaying(false)
  }

  const toggle = () => {
    if (onRef.current) {
      setAsked(false)
      setPlaying(false)
      fadeTo(0, STOP_FADE)
      return
    }
    setAsked(true)
    // Called here, inside the press, rather than from an effect a render
    // later: Safari wants `play()` in the call stack of the gesture that
    // allowed it.
    if (!duckedRef.current) play()
  }

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
      if (next && own && !own.paused) {
        setPlaying(false)
        fadeTo(0, DUCK_FADE)
      } else if (!next && onRef.current) {
        // The element has already been played under a press, so the browser
        // lets it start again without one.
        play()
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
  }, [fadeTo, play, route])

  /* Only ever unmounted with the whole site, but tidy up if it is. */
  useEffect(() => {
    const el = ref.current
    return () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current)
      el?.pause()
    }
  }, [])

  if (broken) return null

  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-[60] md:bottom-10 md:left-10">
      <audio
        ref={ref}
        src={mediaUrl(src)}
        // Nothing is fetched until it is asked for: most visits never press
        // it, and a whole song is a lot to download for a button.
        preload="none"
        onLoadedMetadata={() => {
          const el = ref.current
          if (el && from) el.currentTime = from
        }}
        onTimeUpdate={() => {
          const el = ref.current
          if (!el || to === undefined || el.currentTime < to) return
          finish()
        }}
        onEnded={finish}
        onError={() => setBroken(true)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        // Always spoken from here: on a phone the label is not shown at all,
        // and while it plays the label is the song's name, which says what is
        // playing but not what pressing it will do.
        aria-label={on ? ui.sound.pause : ui.sound.play}
        // A round icon on a phone, the labelled pill from `sm` up: on a phone
        // the pill reaches the middle of the bottom edge, where the index's
        // Contact link and the archive's view switch already sit.
        className="group pointer-events-auto flex h-10 w-10 items-center justify-center gap-2.5 rounded-full border border-white/15 bg-void/60 text-mist backdrop-blur-sm transition-colors duration-300 hover:border-white/45 hover:text-chalk sm:w-auto sm:max-w-[calc(100vw-5rem)] sm:justify-start sm:pr-4 sm:pl-3"
      >
        <svg
          className="h-[18px] w-[18px] shrink-0 overflow-visible"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 9.25h3.25L11.5 5v14l-4.75-4.25H3.5z" fill="currentColor" />
          {/* Two waves, breathing while the song is actually sounding and held
              still while it waits — for the file, or for a film to finish. */}
          <g className={playing && !reduced ? 'speaker-waves' : undefined}>
            <path d="M15 9.2a4 4 0 0 1 0 5.6" />
            <path d="M17.8 6.5a7.8 7.8 0 0 1 0 11" />
          </g>
        </svg>
        <span
          aria-hidden="true"
          className="hidden truncate text-[0.62rem] tracking-[0.28em] uppercase sm:inline"
        >
          {on ? title : ui.sound.play}
        </span>
      </button>
    </div>
  )
}

/**
 * The site's song, and the button that offers it, on every page.
 *
 * Renders nothing extra when the chosen performance is missing or has no
 * recording — a button that cannot play anything is worse than no button.
 */
export function HouseMusicProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { items } = usePerformances()
  const { houseClip } = useMusicCopy()
  const house = items.find((p) => p.slug === houseClip.slug)
  const track = house?.tracks[0]

  return (
    <>
      {children}
      {track?.audioSrc && (
        <HouseMusic
          // A different song is a different element, not a new `src` on a
          // playing one.
          key={track.audioSrc}
          src={track.audioSrc}
          title={house?.title ?? track.title}
          from={houseClip.from}
          to={houseClip.to ?? undefined}
          route={pathname}
        />
      )}
    </>
  )
}
