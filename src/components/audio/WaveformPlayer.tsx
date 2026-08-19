import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '@/types/content'
import { useAudioEngine } from '@/hooks/useAudioEngine'
import { clamp, formatTime, hashString, seededRandom } from '@/lib/utils'
import { mediaUrl } from '@/lib/media'

const BAR_COUNT = 96

/** A plausible song envelope: verse/chorus arc plus per-bar transient jitter. */
function makePeaks(seed: number) {
  const rnd = seededRandom(seed)
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const t = i / (BAR_COUNT - 1)
    const arc =
      0.34 +
      0.42 * Math.sin(t * Math.PI) +
      0.16 * Math.sin(t * Math.PI * 6 + (seed % 5)) +
      0.08 * Math.sin(t * Math.PI * 17)
    return clamp(arc * (0.55 + rnd() * 0.45), 0.07, 1)
  })
}

interface Props {
  tracks: Track[]
  accent: string
  /** Section eyebrow, e.g. "Listen — Live Recording". */
  label?: string
}

/**
 * The audio surface for a performance: a scrubbable waveform wired to a live
 * spectrum analyser, plus the track list.
 *
 * Bar heights are written straight to the DOM from one rAF loop; React only
 * re-renders on track change and on the ~10Hz clock tick.
 */
export function WaveformPlayer({ tracks, accent, label = 'Listen' }: Props) {
  const [index, setIndex] = useState(0)
  const track = tracks[index]
  const seed = useMemo(() => hashString(track?.id ?? 'x'), [track?.id])
  const peaks = useMemo(() => makePeaks(seed), [seed])

  const engine = useAudioEngine({
    src: mediaUrl(track?.audioSrc),
    duration: track?.duration ?? 180,
    seed,
  })
  const { playing, progress, toggle, seek, readLevels, duration, time } = engine

  const barsBase = useRef<(HTMLDivElement | null)[]>([])
  const barsPlayed = useRef<(HTMLDivElement | null)[]>([])
  const clipRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(progress)
  progressRef.current = progress

  const select = useCallback(
    (next: number) => {
      setIndex(((next % tracks.length) + tracks.length) % tracks.length)
    },
    [tracks.length],
  )

  /* Bar animation: base peaks, lifted by the live spectrum near the playhead. */
  useEffect(() => {
    let raf = 0

    const frame = () => {
      const levels = readLevels()
      const head = progressRef.current * (BAR_COUNT - 1)

      if (clipRef.current) {
        clipRef.current.style.clipPath = `inset(0 ${(1 - progressRef.current) * 100}% 0 0)`
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        let scale = peaks[i]
        if (levels) {
          // Bars within a dozen of the playhead react to the spectrum, with
          // the reaction falling off so the waveform still reads as a shape.
          const dist = Math.abs(i - head)
          if (dist < 13) {
            const bin = levels[Math.floor((i / BAR_COUNT) * levels.length)] / 255
            scale = clamp(scale * (1 + bin * 1.5 * (1 - dist / 13)), 0.06, 1.6)
          }
        }
        const v = `scaleY(${scale.toFixed(3)})`
        const a = barsBase.current[i]
        const b = barsPlayed.current[i]
        if (a) a.style.transform = v
        if (b) b.style.transform = v
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [peaks, readLevels])

  const scrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seek((e.clientX - rect.left) / rect.width)
  }

  if (!track) return null

  const bars = (
    ref: React.RefObject<(HTMLDivElement | null)[]>,
    color: string,
    opacity: number,
  ) => (
    <div className="absolute inset-0 flex items-center gap-px">
      {peaks.map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            ref.current[i] = el
          }}
          className="h-full flex-1 origin-center rounded-[1px]"
          style={{ background: color, opacity, willChange: 'transform' }}
        />
      ))}
    </div>
  )

  return (
    <section className="w-full">
      <header className="mb-6 flex items-end justify-between gap-6 border-b border-edge/60 pb-4">
        <div>
          <p className="label text-dust">{label}</p>
          <h3 className="tracked-tight mt-2 text-lg text-chalk md:text-xl">
            {track.title}
          </h3>
          {track.composer && (
            <p className="mt-1 text-xs font-light text-mist">{track.composer}</p>
          )}
        </div>
        <p className="label shrink-0 text-dust tabular-nums">
          {formatTime(time)} <span className="text-edge">/</span>{' '}
          {formatTime(duration)}
        </p>
      </header>

      {/* Waveform */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Seek within ${track.title}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onClick={scrub}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seek(progress + 0.02)
          if (e.key === 'ArrowLeft') seek(progress - 0.02)
        }}
        className="relative h-24 w-full cursor-pointer md:h-32"
      >
        {bars(barsBase, '#55647a', 0.42)}
        <div ref={clipRef} className="absolute inset-0">
          {bars(barsPlayed, accent, 1)}
        </div>

        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px"
          style={{
            left: `${progress * 100}%`,
            background: accent,
            boxShadow: `0 0 16px ${accent}`,
            transition: 'left 120ms linear',
          }}
        />
      </div>

      {/* Transport */}
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={() => select(index - 1)}
          aria-label="Previous track"
          className="text-mist transition-colors hover:text-chalk"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h2v14H6zM20 5v14l-11-7z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-500"
          style={{
            borderColor: `${accent}66`,
            background: playing ? `${accent}1f` : 'transparent',
            boxShadow: playing ? `0 0 38px -6px ${accent}` : 'none',
          }}
        >
          <span
            className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ boxShadow: `0 0 42px -8px ${accent}` }}
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={accent}
            className="relative"
          >
            {playing ? (
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            ) : (
              <path d="M8 5l12 7-12 7z" />
            )}
          </svg>
        </button>

        <button
          type="button"
          onClick={() => select(index + 1)}
          aria-label="Next track"
          className="text-mist transition-colors hover:text-chalk"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 5h2v14h-2zM4 5l11 7-11 7z" />
          </svg>
        </button>

        <label className="ml-auto flex items-center gap-3">
          <span className="label text-dust">Vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={engine.volume}
            onChange={(e) => engine.setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-edge accent-bloom"
            style={{ accentColor: accent }}
          />
        </label>
      </div>

      {engine.mode === 'demo' && (
        <p className="mt-4 text-[0.68rem] font-light tracking-wide text-dust">
          No audio file attached yet — the transport is running a synthesised
          reference tone so the player can be tested. Drop an mp3 at{' '}
          <code className="text-mist">audioSrc</code> to hear the real take.
        </p>
      )}

      {/* Track list */}
      <ol className="mt-10 divide-y divide-edge/50 border-t border-edge/50">
        {tracks.map((t, i) => {
          const active = i === index
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  if (active) toggle()
                  else select(i)
                }}
                className="group flex w-full items-center gap-4 py-4 text-left transition-colors"
              >
                <span
                  className="w-6 shrink-0 text-xs tabular-nums transition-colors"
                  style={{ color: active ? accent : '#55647a' }}
                >
                  {active && playing ? (
                    <span className="flex h-3 items-end gap-[2px]">
                      {[0, 1, 2].map((b) => (
                        <span
                          key={b}
                          className="w-[2px] flex-1 origin-bottom"
                          style={{
                            background: accent,
                            height: '100%',
                            animation: `bar-pulse ${520 + b * 190}ms ease-in-out ${b * 90}ms infinite`,
                          }}
                        />
                      ))}
                    </span>
                  ) : (
                    String(i + 1).padStart(2, '0')
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm transition-colors"
                    style={{ color: active ? '#e8f1f8' : '#8ea6c0' }}
                  >
                    {t.title}
                  </span>
                  {t.note && (
                    <span className="mt-0.5 block truncate text-[0.7rem] font-light text-dust">
                      {t.note}
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-xs tabular-nums text-dust">
                  {formatTime(t.duration)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {track.audioSrc && (
        <audio
          ref={engine.audioRef}
          src={mediaUrl(track.audioSrc)}
          // Load-bearing, and silently so. The engine pipes this element
          // through an AnalyserNode, and Web Audio outputs *silence* for a
          // cross-origin source fetched without CORS — the element still
          // "plays", the clock still advances, and nothing errors. Media
          // lives on R2, a different origin from the site, so without this
          // the player looks perfect and makes no sound.
          // The bucket must serve Access-Control-Allow-Origin to match; see
          // infra/r2-cors.json and MEDIA.md.
          crossOrigin="anonymous"
          preload="metadata"
          onEnded={() => select(index + 1)}
        />
      )}
    </section>
  )
}
