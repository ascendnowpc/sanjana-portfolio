import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Track } from '@/types/content'
import { useAudioEngine } from '@/hooks/useAudioEngine'
import { formatClock, hashString } from '@/lib/utils'
import { mediaUrl } from '@/lib/media'

interface Props {
  /** Stable id — the shelf uses it to keep exactly one card playing. */
  id: string
  /** The album line: the discipline this card collects. */
  album: string
  artist: string
  cover?: string
  tracks: Track[]
  /** Where the full pieces live. */
  href: string
  /** Wide column: a bigger title and a taller list before it scrolls. */
  featured?: boolean
  /** Goes false the moment another card takes the transport. */
  active: boolean
  /** Claim the transport for this card. */
  onPlay: () => void
}

/**
 * One discipline as a record sleeve: cover, transport, and the recordings
 * filed under it.
 *
 * The track list scrolls **inside** the card rather than growing it, which is
 * what lets a card holding twelve recordings sit beside one holding a single
 * take without the column turning into a ladder. The height cap is deliberate
 * — it lands mid-row, so there is always a sliced row telling the reader
 * there is more underneath.
 *
 * Playback is the shared `useAudioEngine`, one instance a card. The audio
 * element preloads nothing: six cards mounting on the About page would
 * otherwise open six range requests before anyone has asked to hear anything.
 *
 * Every lit thing here is `gilt` and nothing else — the frame of the sounding
 * card, the played part of the scrubber, the row playing right now. The point
 * of a single accent is that the eye can find the one card making sound
 * without reading a word.
 */
export function AlbumCard({
  id,
  album,
  artist,
  cover,
  tracks,
  href,
  featured = false,
  active,
  onPlay,
}: Props) {
  const [index, setIndex] = useState(0)
  const [listOpen, setListOpen] = useState(true)
  const [missing, setMissing] = useState(false)
  const track = tracks[index]

  const seed = useMemo(() => hashString(track?.id ?? id), [track?.id, id])
  const engine = useAudioEngine({
    src: mediaUrl(track?.audioSrc),
    duration: track?.duration ?? 180,
    seed,
  })
  const { playing, progress, time, duration, play, pause, toggle, seek } = engine

  /* ------------------------------ transport ------------------------------ */

  /** Set when a *stopped* card is asked to start on its next source. */
  const wantPlayRef = useRef(false)
  const playRef = useRef(play)
  playRef.current = play

  useEffect(() => {
    // A track that has not been asked for yet cannot have failed yet.
    setMissing(false)
    if (!wantPlayRef.current) return
    wantPlayRef.current = false
    void playRef.current()
  }, [track?.id])

  // Hand the transport over cleanly: only one card in the shelf makes sound.
  useEffect(() => {
    if (!active && playing) pause()
  }, [active, playing, pause])

  const go = useCallback(
    (next: number, start = false) => {
      if (!tracks.length) return
      const i = ((next % tracks.length) + tracks.length) % tracks.length
      if (i === index) return
      if (start || playing) onPlay()
      // A running transport carries itself across the source swap (see
      // useAudioEngine); only a stopped one has to be asked to start.
      wantPlayRef.current = start && !playing
      setIndex(i)
    },
    [index, onPlay, playing, tracks.length],
  )

  const onToggle = useCallback(() => {
    if (!playing) onPlay()
    toggle()
  }, [onPlay, playing, toggle])

  /* ------------------------------ scrubbing ------------------------------ */

  const barRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)

  const seekTo = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      seek((clientX - rect.left) / rect.width)
    },
    [seek],
  )

  /* --------------------------- list overflow ---------------------------- */

  const listRef = useRef<HTMLOListElement>(null)
  const [atEnd, setAtEnd] = useState(true)

  // The bottom fade is the affordance, so it may only show while there is in
  // fact something below — a permanent one just dims the final row.
  const measure = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4)
  }, [])

  useEffect(measure, [measure, listOpen, tracks.length])

  if (!track) return null

  /* The card runs on a white ramp of its own rather than the page's mist and
     dust, which are blue-greys: against the reference's plain white type they
     read as grubby. Chalk at four strengths — frame, type, secondary, rule —
     and nothing tinted. */
  const ghost =
    'font-mono text-[0.6rem] uppercase tracking-[0.2em] border border-chalk/45 px-3 py-2 transition-colors duration-400'

  return (
    <article
      className={`relative min-w-0 border bg-ink/40 p-3.5 transition-colors duration-700 md:p-5 ${
        playing
          ? 'border-gilt/60 shadow-[0_0_70px_-34px_var(--color-gilt)]'
          : 'border-chalk/80'
      }`}
    >
      {/* ---------------- header row ---------------- */}
      <div className="mb-3.5 flex items-center justify-between gap-3 md:mb-5">
        <span className={`${ghost} text-chalk/70`}>
          {tracks.length} {tracks.length === 1 ? 'Recording' : 'Recordings'}
        </span>
        <Link
          to={href}
          className={`${ghost} text-chalk hover:border-gilt/70 hover:text-gilt`}
        >
          Watch <span aria-hidden="true">↗</span>
        </Link>
      </div>

      {/* ---------------- cover ---------------- */}
      {/* No play badge over the art. The transport below already says what
          this does, and a scrim over the one photograph on the card was
          covering the thing people came to look at. The sleeve still starts
          playback when clicked; the tilt on hover is the affordance. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${playing ? 'Pause' : 'Play'} ${track.title}`}
        className="sleeve-frame block w-full"
      >
        <span className="sleeve block aspect-square w-full overflow-hidden bg-abyss">
          {cover && (
            <img
              src={mediaUrl(cover)}
              alt={`${album} — cover`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </span>
      </button>

      {/* ---------------- now playing ---------------- */}
      <h3
        className={`mt-5 font-semibold tracking-tight text-chalk ${
          featured ? 'text-2xl md:text-[1.75rem]' : 'text-xl md:text-2xl'
        }`}
      >
        {track.title}
      </h3>
      <p className="mt-2 font-mono text-[0.72rem] tracking-[0.14em] text-chalk/85 md:text-xs">
        {artist} <span className="text-chalk/45">/</span> {album}
      </p>

      {/* ---------------- transport ---------------- */}
      <div className="mt-4 flex items-center gap-2 md:mt-5 md:gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="shrink-0 text-chalk transition-colors duration-300 hover:text-gilt"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            {playing ? (
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            ) : (
              <path d="M8 5l12 7-12 7z" />
            )}
          </svg>
        </button>

        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Previous recording"
          className="shrink-0 text-chalk transition-colors duration-300 hover:text-gilt"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h2v14H6zM20 5v14l-11-7z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="Next recording"
          className="shrink-0 text-chalk transition-colors duration-300 hover:text-gilt"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 5h2v14h-2zM4 5l11 7-11 7z" />
          </svg>
        </button>

        {/* Scrubber. Pointer capture keeps the drag alive outside the bar, so
            a hand that slides off the card still controls the playhead. */}
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-label={`Seek within ${track.title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={formatClock(time)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            dragRef.current = true
            seekTo(e.clientX)
          }}
          onPointerMove={(e) => {
            if (dragRef.current) seekTo(e.clientX)
          }}
          onPointerUp={(e) => {
            dragRef.current = false
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          // A gesture the browser takes over — a scroll, a back-swipe — never
          // sends pointerup, and the bar would follow the cursor afterwards.
          onPointerCancel={() => {
            dragRef.current = false
          }}
          onLostPointerCapture={() => {
            dragRef.current = false
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seek(progress + 0.02)
            if (e.key === 'ArrowLeft') seek(progress - 0.02)
          }}
          className="relative -my-3 min-w-8 flex-1 cursor-pointer touch-none py-3"
        >
          <div className="h-[3px] w-full rounded-full bg-chalk/25">
            <div
              className="h-full rounded-full bg-gilt"
              style={{
                width: `${progress * 100}%`,
                transition: 'width 120ms linear',
              }}
            />
          </div>
          <span
            className={`pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
              playing ? 'bg-gilt' : 'bg-chalk'
            }`}
            style={{ left: `${progress * 100}%`, transition: 'left 120ms linear' }}
          />
        </div>

        <p className="shrink-0 font-mono text-[0.62rem] text-chalk tabular-nums md:text-[0.68rem]">
          {formatClock(time)} <span className="text-chalk/45">/</span>{' '}
          {formatClock(duration)}
        </p>

        {/* Volume: an icon at rest, exactly as in the reference, with the
            slider unfolding on hover or keyboard focus.

            Desktop only, and not just for room in the row: iOS ignores
            `audio.volume` outright, so on the phones this row is tightest on
            the control is decoration. Hardware keys do the job there. */}
        <div className="group/vol hidden shrink-0 items-center md:flex">
          <button
            type="button"
            onClick={() => engine.setVolume(engine.volume > 0 ? 0 : 0.8)}
            aria-label={engine.volume > 0 ? 'Mute' : 'Unmute'}
            className="text-chalk transition-colors duration-300 hover:text-gilt"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 9v6h3.5L12 19V5L7.5 9H4z" />
              {engine.volume > 0 ? (
                <>
                  <path d="M15.2 8.4a1 1 0 0 1 1.4.1 5 5 0 0 1 0 7 1 1 0 1 1-1.5-1.3 3 3 0 0 0 0-4.4 1 1 0 0 1 .1-1.4z" />
                  <path d="M17.9 5.6a1 1 0 0 1 1.4 0 9 9 0 0 1 0 12.7 1 1 0 1 1-1.4-1.4 7 7 0 0 0 0-9.9 1 1 0 0 1 0-1.4z" />
                </>
              ) : (
                <path d="M16.2 9.2l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4L21.1 11l2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4L18.3 11l-2.1-1.8z" />
              )}
            </svg>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={engine.volume}
            onChange={(e) => engine.setVolume(Number(e.target.value))}
            aria-label="Volume"
            // pointer-events matter as much as the width: a range input paints
            // its thumb outside its box, so a collapsed w-0 slider still sits
            // over the speaker icon and eats the click that would open it.
            className="pointer-events-none ml-0 h-1 w-0 cursor-pointer appearance-none rounded-full bg-chalk/25 opacity-0 transition-all duration-500 group-hover/vol:pointer-events-auto group-hover/vol:ml-2.5 group-hover/vol:w-16 group-hover/vol:opacity-100 focus-visible:pointer-events-auto focus-visible:ml-2.5 focus-visible:w-16 focus-visible:opacity-100"
            style={{ accentColor: 'var(--color-gilt)' }}
          />
        </div>

        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          aria-expanded={listOpen}
          aria-label={listOpen ? 'Hide the recordings' : 'Show the recordings'}
          className={`shrink-0 transition-colors duration-300 hover:text-gilt ${
            listOpen ? 'text-gilt' : 'text-chalk'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 5h9v2H3zM3 10h9v2H3zM3 15h6v2H3z" />
            <path d="M20 3v9.2a3 3 0 1 0 1.6 2.6V6.6L23 6V3h-3zm-.6 13.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z" />
          </svg>
        </button>
      </div>

      {missing && (
        <p className="mt-3 font-mono text-[0.62rem] leading-relaxed text-chalk/55">
          Audio for this take is not on the media host yet.
        </p>
      )}

      {/* ---------------- the recordings ---------------- */}
      {listOpen && (
        <ol
          ref={listRef}
          onScroll={measure}
          className="track-scroll mt-4 overflow-y-auto overscroll-contain border-t border-chalk/45 md:mt-5"
          style={{
            maxHeight: featured ? '16.5rem' : '13.25rem',
            maskImage: atEnd
              ? undefined
              : 'linear-gradient(to bottom, #000 76%, transparent)',
            WebkitMaskImage: atEnd
              ? undefined
              : 'linear-gradient(to bottom, #000 76%, transparent)',
          }}
        >
          {tracks.map((t, i) => {
            const current = i === index
            return (
              <li key={t.id} className="border-b border-chalk/30 last:border-b-0">
                <button
                  type="button"
                  onClick={() => (current ? onToggle() : go(i, true))}
                  aria-current={current ? 'true' : undefined}
                  className="group/row flex w-full items-center gap-4 py-3.5 text-left"
                >
                  <span
                    className={`w-5 shrink-0 font-mono text-[0.7rem] tabular-nums ${
                      current ? 'text-gilt' : 'text-chalk/60'
                    }`}
                  >
                    {current && playing ? (
                      <span className="flex h-3 items-end gap-[2px]">
                        {[0, 1, 2].map((b) => (
                          <span
                            key={b}
                            className="w-[2px] origin-bottom bg-gilt"
                            style={{
                              height: '100%',
                              animation: `bar-pulse ${520 + b * 190}ms ease-in-out ${b * 90}ms infinite`,
                            }}
                          />
                        ))}
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>

                  <span
                    className={`min-w-0 flex-1 truncate font-mono text-[0.78rem] transition-colors duration-300 ${
                      current
                        ? 'text-gilt'
                        : 'text-chalk/85 group-hover/row:text-chalk'
                    }`}
                  >
                    {t.title}
                  </span>

                  <span
                    className={`shrink-0 font-mono text-[0.72rem] tabular-nums ${
                      current ? 'text-gilt/70' : 'text-chalk/70'
                    }`}
                  >
                    {formatClock(t.duration)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {track.audioSrc && (
        <audio
          ref={engine.audioRef}
          src={mediaUrl(track.audioSrc)}
          // Load-bearing: the engine pipes this element through an
          // AnalyserNode, and Web Audio outputs *silence* for a cross-origin
          // source fetched without CORS. Media lives on R2, a different
          // origin from the site. See WaveformPlayer and infra/r2-cors.json.
          crossOrigin="anonymous"
          // Six cards mount at once here. Nothing is fetched until a play is
          // asked for; the durations on screen come from the content, not
          // from metadata.
          preload="none"
          onPlaying={() => setMissing(false)}
          onError={() => setMissing(true)}
          onEnded={() => {
            if (index < tracks.length - 1) go(index + 1)
            else {
              pause()
              seek(0)
            }
          }}
        />
      )}
    </article>
  )
}
