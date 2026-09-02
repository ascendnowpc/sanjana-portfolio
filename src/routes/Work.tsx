import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CategoryId, Performance } from '@/types/content'
import { CATEGORIES, CATEGORY_MAP } from '@/data/categories'
import { usePerformances } from '@/hooks/useContent'
import { useTransition } from '@/components/layout/TransitionProvider'
import {
  VideoReel,
  piecesPerReel,
  type ReelPiece,
} from '@/components/media/VideoReel'
import { Reveal } from '@/components/ui/Reveal'
import { SplitText } from '@/components/ui/SplitText'
import { cn } from '@/lib/utils'

type Filter = CategoryId | 'all'

/**
 * Pixels per second, cycled through the strips.
 *
 * Slow — this is a room, not a ticker — and no two neighbours share a rate, so
 * the strips drift out of step with each other instead of marching down the
 * page in formation.
 */
const SPEEDS = [34, 26, 30, 22]

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

  /**
   * The window, as the strip sizes see it.
   *
   * How many pieces belong in a strip depends on how many cards fit across the
   * screen, so the deal has to be redone when the screen changes.
   */
  const [screen, setScreen] = useState(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }))
  useEffect(() => {
    const onResize = () =>
      setScreen((s) =>
        s.width === window.innerWidth && s.height === window.innerHeight
          ? s
          : { width: window.innerWidth, height: window.innerHeight },
      )
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /**
   * The archive dealt into short strips, newest first.
   *
   * A handful of pieces each, several strips down the page — not one run of
   * thirty-six. The size is the fewest cards that still cover the screen (see
   * `piecesPerReel`), which is five on most displays: fewer and a strip would
   * be showing the same piece twice at once as it loops.
   *
   * The last strip is not left with the remainder. Dealing 36 into fives ends
   * with a strip of one, which cannot loop at all and sits there as a single
   * stranded card; sharing the shortfall out gives strips of 5 and 4 instead.
   */
  const strips = useMemo(() => {
    const pieces = filtered.map(toPiece)
    const size = piecesPerReel(screen.width, screen.height)
    if (pieces.length <= size) return [pieces]
    const count = Math.ceil(pieces.length / size)
    const each = Math.floor(pieces.length / count)
    const extra = pieces.length % count
    const out: ReelPiece[][] = []
    let at = 0
    for (let i = 0; i < count; i++) {
      const take = each + (i < extra ? 1 : 0)
      out.push(pieces.slice(at, at + take))
      at += take
    }
    return out
  }, [filtered, screen])

  // Stable, so the cards inside the reels stay memoised while the rows drift.
  const open = useCallback(
    (piece: ReelPiece, el: HTMLElement) =>
      zoomTo(el, piece.poster, piece.title, `/work/${piece.slug}`),
    [zoomTo],
  )

  // Reported by the first strip: whether it ended up with more work than fits
  // on screen, and so with somewhere to travel.
  const [drifting, setDrifting] = useState(true)


  const setFilter = (f: Filter) => {
    if (f === 'all') setParams({}, { replace: true })
    else setParams({ category: f }, { replace: true })
  }

  return (
    <div className="min-h-screen bg-void pt-20 pb-28 md:pt-28">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <header className="mb-8">
          <p className="label mb-6 text-bloom">The Work</p>
          <h1 className="tracked text-[clamp(2rem,6vw,4.75rem)] leading-[1.1] text-chalk">
            <SplitText text="Every Room" />
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed font-light text-mist">
            Concert halls, black boxes, chapels and garages — sorted newest
            first. Open anything to watch it in full and hear the recording.
          </p>
        </header>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-edge/50 py-3.5">
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
          <p className="label mb-5 text-dust">
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

      {/* The strips run edge to edge, outside the page's gutter: a frame cut
          off by the side of the screen is what says the strip continues past
          it. */}
      <div className="flex flex-col gap-7 md:gap-9">
        {strips.map((pieces, i) => (
          <VideoReel
            key={`${active}-${i}`}
            items={pieces}
            speed={SPEEDS[i % SPEEDS.length]}
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
  }
}
