import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp } from '@/lib/utils'

interface Options {
  /** When present, a real file is streamed. When absent, demo mode runs. */
  src?: string
  /** Fallback length in seconds, used by demo mode and by the scrubber. */
  duration: number
  /** Seeds the demo chord so each track sounds different but consistent. */
  seed: number
}

/** A minor-9 voicing, in semitones from the root. */
const CHORD = [0, 7, 15, 22, 26]
const ROOTS = [110, 116.54, 123.47, 130.81, 146.83, 164.81]

/**
 * Playback for the track lists, in two modes behind one API.
 *
 * `file` mode streams the attached mp3/wav through an AnalyserNode.
 * `demo` mode — used until real audio is attached — synthesises a slow pad
 * from the track's seed, so the transport, scrubber and visualiser are all
 * genuinely exercised rather than faked.
 *
 * `time` is throttled to ~10Hz on purpose: the visualiser reads levels from a
 * ref inside its own rAF, so nothing here needs to render at frame rate.
 */
export function useAudioEngine({ src, duration, seed }: Options) {
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const levelsRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(64))
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const voicesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([])
  const masterRef = useRef<GainNode | null>(null)

  /** Seconds of the track already elapsed at the moment playback last began. */
  const offsetRef = useRef(0)
  /** ctx.currentTime when playback last began. */
  const startedAtRef = useRef(0)

  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [ready, setReady] = useState(!src)

  const mode = src ? 'file' : 'demo'
  const total = duration || 1

  /* ------------------------- graph construction ------------------------- */

  const ensureCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new Ctor()

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.78
    analyser.connect(ctx.destination)

    const master = ctx.createGain()
    master.gain.value = volume
    master.connect(analyser)

    ctxRef.current = ctx
    analyserRef.current = analyser
    masterRef.current = master
    levelsRef.current = new Uint8Array(analyser.frequencyBinCount)
    return ctx
  }, [volume])

  const stopVoices = useCallback(() => {
    const ctx = ctxRef.current
    voicesRef.current.forEach(({ osc, gain }) => {
      if (ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
        osc.stop(ctx.currentTime + 0.5)
      } else {
        osc.stop()
      }
    })
    voicesRef.current = []
  }, [])

  /** Builds the demo pad: a detuned minor-9 under a slowly sweeping filter. */
  const startVoices = useCallback(() => {
    const ctx = ensureCtx()
    const master = masterRef.current
    if (!master) return
    stopVoices()

    const root = ROOTS[seed % ROOTS.length]

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.Q.value = 3
    filter.connect(master)

    // Slow cutoff sweep so the pad breathes instead of sitting flat.
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.07
    lfoGain.gain.value = 620
    lfo.connect(lfoGain).connect(filter.frequency)
    lfo.start()

    CHORD.forEach((semi, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? 'sine' : 'triangle'
      osc.frequency.value = root * Math.pow(2, semi / 12)
      osc.detune.value = (i - 2) * 5

      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.gain.setTargetAtTime(0.13 / (i * 0.5 + 1), ctx.currentTime, 0.9)

      osc.connect(gain).connect(filter)
      osc.start()
      voicesRef.current.push({ osc, gain })
    })

    voicesRef.current.push({
      osc: lfo,
      gain: lfoGain as unknown as GainNode,
    })
  }, [ensureCtx, seed, stopVoices])

  /* ------------------------------ transport ------------------------------ */

  const play = useCallback(async () => {
    const ctx = ensureCtx()
    if (ctx.state === 'suspended') await ctx.resume()

    if (mode === 'file') {
      const el = audioRef.current
      if (!el) return
      if (!el.dataset.piped) {
        // A media element can only ever be piped into the graph once.
        //
        // Routing through the analyser is what makes the visualiser react to
        // the actual take, but it is also the one thing that can turn audible
        // playback into silence: a cross-origin file fetched without CORS
        // taints the graph and Web Audio emits nothing. If the node cannot be
        // built, leave the element unpiped — it then plays straight to the
        // speakers and the visualiser falls back to its static shape.
        // Being heard matters more than reacting.
        try {
          const node = ctx.createMediaElementSource(el)
          node.connect(masterRef.current!)
          el.dataset.piped = '1'
        } catch (err) {
          console.warn('[audio] analyser unavailable, playing direct:', err)
          el.dataset.piped = 'direct'
        }
      }
      el.volume = volume
      el.currentTime = offsetRef.current
      try {
        await el.play()
      } catch (err) {
        // Two things reject here: a file that is missing or unplayable, and a
        // play() that a source swap interrupted mid-load. Neither may leave
        // the transport claiming to run, and neither may surface as an
        // unhandled rejection — the About page mounts six of these players.
        console.warn('[audio] playback failed:', err)
        setPlaying(false)
        return
      }
    } else {
      startedAtRef.current = ctx.currentTime
      startVoices()
    }
    setPlaying(true)
  }, [ensureCtx, mode, startVoices, volume])

  const pause = useCallback(() => {
    if (mode === 'file') {
      audioRef.current?.pause()
      offsetRef.current = audioRef.current?.currentTime ?? 0
    } else {
      const ctx = ctxRef.current
      if (ctx) {
        offsetRef.current = clamp(
          offsetRef.current + (ctx.currentTime - startedAtRef.current),
          0,
          total,
        )
      }
      stopVoices()
    }
    setPlaying(false)
  }, [mode, stopVoices, total])

  const toggle = useCallback(() => {
    if (playing) pause()
    else void play()
  }, [pause, play, playing])

  const seek = useCallback(
    (ratio: number) => {
      const next = clamp(ratio, 0, 1) * total
      offsetRef.current = next
      setTime(next)
      if (mode === 'file' && audioRef.current) {
        audioRef.current.currentTime = next
      } else if (playing) {
        startedAtRef.current = ctxRef.current?.currentTime ?? 0
      }
    },
    [mode, playing, total],
  )

  /** Live spectrum for the visualiser. Read from a rAF, never from render. */
  const readLevels = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser || !playing) return null
    analyser.getByteFrequencyData(levelsRef.current)
    return levelsRef.current
  }, [playing])

  /* -------------------------- clock + lifecycle -------------------------- */

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let lastPush = 0

    const tick = (now: number) => {
      let t: number
      if (mode === 'file') {
        t = audioRef.current?.currentTime ?? 0
      } else {
        const ctx = ctxRef.current
        t = ctx ? offsetRef.current + (ctx.currentTime - startedAtRef.current) : 0
        if (t >= total) {
          offsetRef.current = 0
          startedAtRef.current = ctx?.currentTime ?? 0
          t = 0
        }
      }
      if (now - lastPush > 100) {
        lastPush = now
        setTime(t)
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode, playing, total])

  /* Latest handles, read by effects that must not re-run when they change:
     `play` is rebuilt on every volume change, and the reset below must fire
     on a source swap and nothing else. */
  const playRef = useRef(play)
  playRef.current = play
  const playingRef = useRef(playing)
  playingRef.current = playing

  // Reset the transport whenever the caller switches track.
  useEffect(() => {
    offsetRef.current = 0
    setTime(0)
    setReady(!src)
    // Swapping the source reloads the media element and silences the graph,
    // but a listener who was mid-song asked for the *next* track, not for
    // silence: carry the intent across rather than leaving the transport
    // claiming to play an element that has stopped.
    if (playingRef.current) void playRef.current()
    return () => {
      stopVoices()
      audioRef.current?.pause()
    }
  }, [src, seed, stopVoices])

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = volume
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(
    () => () => {
      stopVoices()
      void ctxRef.current?.close()
    },
    [stopVoices],
  )

  return {
    mode,
    audioRef,
    playing,
    time,
    duration: total,
    progress: clamp(time / total, 0, 1),
    ready,
    setReady,
    volume,
    setVolume,
    play,
    pause,
    toggle,
    seek,
    readLevels,
  }
}
