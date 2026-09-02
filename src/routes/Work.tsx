import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CategoryId, Performance } from '@/types/content'
import { CATEGORIES, CATEGORY_MAP } from '@/data/categories'
import { usePerformances } from '@/hooks/useContent'
import { useTransition } from '@/components/layout/TransitionProvider'
import { VideoReel, type ReelPiece } from '@/components/media/VideoReel'
import { Reveal } from '@/components/ui/Reveal'
import { SplitText } from '@/components/ui/SplitText'
import { cn } from '@/lib/utils'

type Filter = CategoryId | 'all'

/**
 * Above this many pieces the archive is split across two reels.
 *
 * One row of thirty-six is a very long way to travel to reach the far end of
 * it, and halving the journey costs nothing: both rows run the same direction
 * at slightly different speeds, so they read as one moving surface rather than
 * as two lists.
 */
const SPLIT_AT = 10

/** Pixels per second per row. Slow — this is a room, not a ticker. */
const SPEEDS = [30, 23]

/**
 * Row height, which sets the scale of everything in the reel.
 *
 * Chosen against the fold rather than by eye: the page carries a heading, a
 * filter bar and a hint above the first row, and a card whose caption lands
 * below the bottom of the screen is a card nobody can read without scrolling
 * past the thing it labels.
 */
const ROW_HEIGHT = 'clamp(190px, 23vw, 340px)'

export default function Work() {
  const { items } = usePerformances()
  const [params, setParams] = useSearchParams()
  const active = (params.get('category') as Filter) ?? 'all'
  const { zoomTo } = useTransition()

  const filtered = useMemo(
    () =>
      (active === 'all' ? items : items.filter((p) => p.category === active))
        .slice()
        .sort((a, b) => b.year - a.year),
    [items, active],
  )

  /** The reels, newest first, dealt into one or two rows. */
  const rows = useMemo(() => {
    const pieces = filtered.map(toPiece)
    if (pieces.length <= SPLIT_AT) return [pieces]
    const half = Math.ceil(pieces.length / 2)
    return [pieces.slice(0, half), pieces.slice(half)]
  }, [filtered])

  // Stable, so the cards inside the reels stay memoised while the rows drift.
  const open = useCallback(
    (piece: ReelPiece, el: HTMLElement) =>
      zoomTo(el, piece.poster, piece.title, `/work/${piece.slug}`),
    [zoomTo],
  )

  // Reported by the first reel, which is always the longest: whether it ended
  // up with more work than fits on screen, and so with somewhere to travel.
  const [drifting, setDrifting] = useState(true)

  const setFilter = (f: Filter) => {
    if (f === 'all') setParams({}, { replace: true })
    else setParams({ category: f }, { replace: true })
  }

  return (
    <div className="min-h-screen bg-void pt-24 pb-28 md:pt-32">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <header className="mb-10">
          <p className="label mb-6 text-bloom">The Work</p>
          <h1 className="tracked text-[clamp(2rem,6vw,4.75rem)] leading-[1.1] text-chalk">
            <SplitText text="Every Room" />
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed font-light text-mist">
            Concert halls, black boxes, chapels and garages — sorted newest
            first. Open anything to watch it in full and hear the recording.
          </p>
        </header>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-edge/50 py-4">
          {(
            [{ id: 'all', label: 'All Work', accent: '#4fd8e8' }, ...CATEGORIES] as const
          ).map((c) => {
            const on = active === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id as Filter)}
                className="group relative py-1"
              >
                <span
                  className={cn(
                    'label transition-colors duration-300',
                    on ? 'text-chalk' : 'text-dust hover:text-mist',
                  )}
                >
                  {c.label}
                </span>
                <span
                  className="absolute -bottom-0.5 left-0 h-px transition-all duration-500"
                  style={{
                    width: on ? '100%' : 0,
                    background: c.accent,
                    boxShadow: on ? `0 0 12px ${c.accent}` : 'none',
                  }}
                />
              </button>
            )
          })}

          <span className="label ml-auto text-dust tabular-nums">
            {String(filtered.length).padStart(2, '0')} pieces
          </span>
        </div>

        {active !== 'all' && (
          <p className="mb-4 max-w-lg text-sm font-light text-mist">
            {CATEGORY_MAP[active].blurb}
          </p>
        )}

        {/* Two hints, because the row answers to two different hands: a cursor
            can rest on a frame to stop it, a thumb cannot. Neither is offered
            for a category short enough that its reel holds still — nothing
            there travels, and there is nothing to hold. */}
        {filtered.length > 0 && (
          <p className="label mb-6 text-dust">
            {drifting ? (
              <>
                <span className="hidden md:inline">
                  Hover to hold a frame — drag to travel — click to open
                </span>
                <span className="md:hidden">Drag to travel — tap to open</span>
              </>
            ) : (
              <span>Click any frame to open it</span>
            )}
          </p>
        )}
      </div>

      {/* The reels run edge to edge, outside the page's gutter: a frame cut off
          by the side of the screen is what says the row continues past it. */}
      <div className="flex flex-col gap-4">
        {rows.map((pieces, i) => (
          <VideoReel
            key={i}
            items={pieces}
            speed={SPEEDS[i] ?? SPEEDS[0]}
            height={ROW_HEIGHT}
            onOpen={open}
            onLoopingChange={i === 0 ? setDrifting : undefined}
          />
        ))}
      </div>

      {!filtered.length && (
        <Reveal>
          <p className="py-24 text-center text-sm text-dust">
            Nothing filed under this category yet.
          </p>
        </Reveal>
      )}
    </div>
  )
}

/** A performance as the reel wants it: one frame, one caption, one shape. */
function toPiece(p: Performance): ReelPiece {
  return {
    slug: p.slug,
    title: p.title,
    meta: `${CATEGORY_MAP[p.category].label} — ${p.year}`,
    poster: p.poster,
    // The short cut, never the full recording — see the note in VideoReel.
    src: p.previewSrc ?? p.videoSrc,
    aspect: p.aspect ?? 16 / 9,
    accent: p.accent ?? CATEGORY_MAP[p.category].accent,
  }
}
