import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MusicalCover } from '@/types/content'
import { useCovers, useUi } from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { fill } from '@/lib/copy'
import { formatClock, hashString } from '@/lib/utils'
import { mediaUrl } from '@/lib/media'
import { useAudioEngine } from '@/hooks/useAudioEngine'
import { Reveal } from '@/components/ui/Reveal'
import { EditableText } from '@/components/edit/Editable'
import { MediaEdit } from '@/components/edit/EditableMedia'
import { AddItem, ItemControls, RegionEdit } from '@/components/edit/ListEdit'

/**
 * The covers shelf: songs she did not write, sung anyway.
 *
 * Deliberately not built out of `AlbumCard`, which the recordings shelf uses.
 * That card is a *discipline* — a sleeve with a scrolling list of every take
 * filed under it, and a link into that corner of the archive. A cover is one
 * song: there is no list to scroll and nowhere to link to, and the fact worth
 * setting in type is whose song it is. Reusing the record sleeve would have
 * meant a card with a one-row list and a dead link in it.
 *
 * What it does share is the rule that matters on a page with several players on
 * it: one sounds at a time, and starting one stops the rest.
 *
 * Empty, it renders nothing for a visitor — and in edit mode, the one button
 * that adds the first cover. The shelf's second key is hidden alongside it (see
 * `Shelf`), so a site with no covers looks exactly as it did before this
 * existed.
 */
export function CoversShelf() {
  const covers = useCovers()
  const { editing } = useEdit()
  const ui = useUi()

  /** Featured first, otherwise the order they are in. */
  const ordered = useMemo(
    () =>
      covers
        .map((cover, index) => ({ cover, index }))
        .sort((a, b) =>
          Number(Boolean(b.cover.featured)) - Number(Boolean(a.cover.featured)),
        ),
    [covers],
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const [watching, setWatching] = useState<MusicalCover | null>(null)

  if (!covers.length) {
    if (!editing) return null
    return (
      <div className="mt-14 rounded-sm border border-dashed border-white/15 px-6 py-16 text-center">
        <p className="text-sm font-light text-mist">{ui.covers.empty}</p>
        <AddItem
          path={['covers']}
          label="Add the first cover"
          className="mt-6"
          blank={() => ({
            id: `cover-${Date.now().toString(36)}`,
            title: 'New song',
            artist: 'Original artist',
            cover: '',
            duration: 0,
          })}
        />
        <p className="mx-auto mt-4 max-w-md text-[0.72rem] leading-relaxed text-dust">
          Then drop a recording on the sleeve: the audio is lifted out of it here
          in the browser, and the still comes off the film.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Three across on a wide screen rather than the recordings shelf's two
          unequal columns. These cards are all the same size because the things
          they hold are — one song each — and the stagger over there exists to
          say the opposite, that one discipline runs deeper than another. */}
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map(({ cover, index }, position) => (
          <Reveal key={cover.id} delay={position * 0.06} y={30} className="min-w-0">
            <CoverCard
              cover={cover}
              index={index}
              active={activeId === cover.id}
              onPlay={() => setActiveId(cover.id)}
              onWatch={() => setWatching(cover)}
            />
          </Reveal>
        ))}
      </div>

      {editing && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <AddItem
            path={['covers']}
            label="Add a cover"
            blank={() => ({
              id: `cover-${Date.now().toString(36)}`,
              title: 'New song',
              artist: 'Original artist',
              cover: '',
              duration: 0,
            })}
          />
          <RegionEdit drawer="covers" label="All cover fields" />
        </div>
      )}

      {watching &&
        createPortal(
          <VideoLightbox cover={watching} onClose={() => setWatching(null)} />,
          document.body,
        )}
    </>
  )
}

/* ================================= card ================================= */

function CoverCard({
  cover,
  index,
  active,
  onPlay,
  onWatch,
}: {
  cover: MusicalCover
  /** Its place in the content array — what the editing controls write to. */
  index: number
  active: boolean
  onPlay: () => void
  onWatch: () => void
}) {
  const ui = useUi()
  const { editing } = useEdit()
  const [missing, setMissing] = useState(false)

  const seed = useMemo(() => hashString(cover.id), [cover.id])
  const engine = useAudioEngine({
    src: mediaUrl(cover.audioSrc),
    duration: cover.duration || 180,
    seed,
  })
  const { playing, progress, time, duration, pause, toggle, seek, audioRef, mode } =
    engine

  // Hand the transport over cleanly: one card on the shelf makes sound.
  useEffect(() => {
    if (!active && playing) pause()
  }, [active, playing, pause])

  const base: (string | number)[] = ['covers', index]
  const accent = cover.accent && /^#[0-9a-fA-F]{6}$/.test(cover.accent) ? cover.accent : undefined

  return (
    <article
      className={`group relative flex min-w-0 flex-col ${editing ? 'edit-region' : ''}`}
      style={
        active && accent
          ? { boxShadow: `0 0 0 1px ${accent}, 0 18px 60px -30px ${accent}` }
          : undefined
      }
    >
      {editing && (
        <ItemControls
          path={['covers']}
          index={index}
          className="absolute -top-3 -right-2 z-40"
          blank={() => ({
            id: `cover-${Date.now().toString(36)}`,
            title: 'New song',
            artist: 'Original artist',
            cover: '',
            duration: 0,
          })}
        />
      )}

      {/* ---------------- the sleeve ---------------- */}
      <div
        className={`relative overflow-hidden bg-ink transition-shadow duration-700 ${
          active ? 'shadow-[0_0_0_1px_var(--color-gilt)]' : ''
        }`}
        style={{ aspectRatio: '4 / 5' }}
      >
        {cover.cover ? (
          <img
            src={mediaUrl(cover.cover)}
            alt={cover.title ? `${cover.title} — sleeve` : ''}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-abyss">
            <span className="label text-dust">No sleeve</span>
          </div>
        )}

        {/* The transport, over the bottom of the sleeve. It is always visible on
            the sounding card and on hover everywhere else: a control that only
            appears on hover is a control a touch screen cannot find, and a
            playing card has to show its own state without being pointed at. */}
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-void/95 to-transparent px-4 pt-10 pb-4 transition-opacity duration-500 ${
            playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (!playing) onPlay()
              void toggle()
            }}
            aria-label={
              playing
                ? ui.music.pause
                : fill(ui.covers.videoLabel, { title: cover.title || 'this cover' })
            }
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-chalk/60 text-chalk transition-colors hover:border-gilt hover:text-gilt"
          >
            {playing ? (
              <span className="flex gap-[3px]">
                <span className="block h-3 w-[3px] bg-current" />
                <span className="block h-3 w-[3px] bg-current" />
              </span>
            ) : (
              <span className="ml-[2px] block h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-current" />
            )}
          </button>

          {/* The scrubber. `input[type=range]` rather than a div with a pointer
              handler: it is a slider, and the native one is the only version
              that comes with keyboard control and a screen-reader value. */}
          <label className="min-w-0 flex-1">
            <span className="sr-only">{fill(ui.music.seek, { title: cover.title })}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={(e) => seek(Number(e.target.value) * duration)}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-chalk/25 accent-[var(--color-gilt)]"
              style={{
                background: `linear-gradient(to right, var(--color-gilt) ${progress * 100}%, rgb(242 242 242 / 0.25) ${progress * 100}%)`,
              }}
            />
          </label>

          <span className="shrink-0 font-[family-name:var(--font-mono)] text-[0.62rem] text-mist tabular-nums">
            {formatClock(time)} / {formatClock(duration)}
          </span>
        </div>

        {/* Replacing the sleeve, and replacing the film that made it. */}
        <MediaEdit
          target={{
            path: [...base, 'cover'],
            kind: 'cover',
            label: 'Sleeve',
            clearable: true,
          }}
          label="Sleeve"
          className="top-0 bottom-auto h-1/2"
        />
        <MediaEdit
          target={{
            path: [...base, 'videoSrc'],
            kind: 'video',
            label: 'Cover video',
            clearable: true,
            derive: {
              audio: [...base, 'audioSrc'],
              poster: [...base, 'cover'],
              duration: [...base, 'duration'],
            },
          }}
          label="Film & audio"
          className="top-1/2 bottom-auto h-1/2"
        />
      </div>

      {/* The file, when there is one. `mode` is 'demo' when the engine is
          sounding a reference tone because no audio is attached — worth saying
          rather than leaving somebody to wonder why a cover sounds like a chord. */}
      {cover.audioSrc && (
        <audio
          ref={audioRef}
          src={mediaUrl(cover.audioSrc)}
          preload="none"
          onError={() => setMissing(true)}
          className="hidden"
        />
      )}

      {/* ---------------- the type ---------------- */}
      <div className="mt-4 min-w-0">
        <h3 className="tracked text-sm text-chalk">
          <EditableText
            path={[...base, 'title']}
            value={cover.title}
            placeholder="Song"
          />
        </h3>
        <p className="mt-1 text-[0.78rem] font-light text-mist">
          {editing ? (
            <>
              {ui.covers.original.replace('{artist}', '').trim()}{' '}
              <EditableText
                path={[...base, 'artist']}
                value={cover.artist}
                placeholder="Original artist"
              />
            </>
          ) : (
            fill(ui.covers.original, { artist: cover.artist })
          )}
        </p>
        {(cover.note || editing) && (
          <p className="mt-2 text-[0.74rem] leading-relaxed font-light text-dust">
            <EditableText
              path={[...base, 'note']}
              value={cover.note ?? ''}
              placeholder="Liner note"
              multiline
            />
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {cover.videoSrc && (
            <button
              type="button"
              onClick={onWatch}
              className="label text-dust transition-colors hover:text-chalk"
            >
              {ui.covers.watch}
            </button>
          )}
          {missing && (
            <span className="label text-red-400/80">{ui.music.audioMissing}</span>
          )}
          {mode === 'demo' && !cover.audioSrc && (
            <span className="label text-dust/70">{ui.player.demoNote}</span>
          )}
        </div>
      </div>
    </article>
  )
}

/* ============================== the film ============================== */

/**
 * The film, over the page.
 *
 * Plain `controls`, and nothing built on top of them. The site has its own
 * player on the archive's detail pages, where a recording is the subject of the
 * whole screen; here it is one card's second thought, and the browser's own
 * transport is the one every viewer already knows how to work.
 */
function VideoLightbox({
  cover,
  onClose,
}: {
  cover: MusicalCover
  onClose: () => void
}) {
  const ui = useUi()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-void/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={fill(ui.covers.videoLabel, { title: cover.title })}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-5xl">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="tracked truncate text-sm text-chalk">{cover.title}</p>
            <p className="mt-1 truncate text-xs font-light text-mist">
              {fill(ui.covers.original, { artist: cover.artist })}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="label shrink-0 border border-edge px-4 py-2 text-chalk transition-colors hover:border-bloom"
          >
            {ui.covers.closeVideo}
          </button>
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a recording of a song */}
        <video
          src={mediaUrl(cover.videoSrc)}
          poster={mediaUrl(cover.cover)}
          controls
          autoPlay
          playsInline
          className="max-h-[78vh] w-full bg-black"
        />
      </div>
    </div>
  )
}
