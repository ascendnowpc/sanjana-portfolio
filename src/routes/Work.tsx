import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { CategoryId, Performance } from '@/types/content'
import { CATEGORIES, CATEGORY_MAP } from '@/data/categories'
import { usePerformances } from '@/hooks/useContent'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { useTransition } from '@/components/layout/TransitionProvider'
import { LoopingPreview } from '@/components/media/LoopingPreview'
import { IndexRow, splitTitle } from '@/components/works/IndexRow'
import { Segmented, type SegmentedOption } from '@/components/works/Segmented'
import { WorkFrame } from '@/components/works/WorkFrame'
import { mediaUrl } from '@/lib/media'

type Filter = CategoryId | 'all'
type View = 'grid' | 'list'

/**
 * The archive index.
 *
 * Two readings of the same thirty-six pieces, switched from the key at the
 * foot of the page: a **list** that is nothing but names and their sections,
 * and a **grid** that is nothing but pictures, banded by section. Both are
 * built out of the same row (`IndexRow`), so a title sits in exactly the same
 * place whichever way you are reading.
 *
 * The behaviour that ties them together is the hover: pointing at one entry
 * drops everything else to a sixteenth of its opacity, and the one thing left
 * lit comes forward. In list view there are no pictures on the page at all,
 * so the piece's footage has nowhere to go but behind the type, where it
 * fills the viewport. In grid view the picture is already there, and it stays
 * a **still** — the frame eases in and takes its name, and nothing swaps to
 * video. Nothing about that reaches the nav: the page dims under it, not with
 * it.
 *
 * Both the filter and the view live in the query string (`?category=`,
 * `?view=`), so any state of this page is a link somebody can send.
 */

/**
 * The inset the index's type sits at.
 *
 * Deliberately the nav's own container and padding rather than a tighter
 * gutter of its own: the reference's titles start exactly under its wordmark,
 * and copying the *offset* — 24px, because its bar is full width — instead of
 * the relationship would leave every heading on this page staggered against
 * the site name above it. The frames ignore this and run to the screen edges,
 * which is the one place the reference does break its own gutter.
 */
const GUTTER = 'mx-auto w-full max-w-[1600px] px-6 md:px-12'

const VIEW_OPTIONS: readonly SegmentedOption<View>[] = [
  { value: 'grid', label: 'Grid View' },
  { value: 'list', label: 'List View' },
]

export default function Work() {
  const { items } = usePerformances()
  const [params, setParams] = useSearchParams()
  const { zoomTo } = useTransition()
  const reduced = usePrefersReducedMotion()

  // Read, not trusted: `?category=nonsense` falls back to everything rather
  // than filtering the page down to nothing.
  const raw = params.get('category')
  const active: Filter =
    raw && raw in CATEGORY_MAP ? (raw as CategoryId) : 'all'
  const view: View = params.get('view') === 'list' ? 'list' : 'grid'

  const filtered = useMemo(
    () =>
      (active === 'all' ? items : items.filter((p) => p.category === active))
        .slice()
        .sort((a, b) => b.year - a.year || a.slug.localeCompare(b.slug)),
    [items, active],
  )

  /**
   * The grid's bands: one per category, in the order the categories are
   * declared rather than by size, so the shape of the page is the same every
   * visit. Empty ones are dropped — a heading over no frames reads as a
   * loading failure.
   */
  const sections = useMemo(() => {
    const wanted =
      active === 'all' ? CATEGORIES : CATEGORIES.filter((c) => c.id === active)
    return wanted
      .map((category) => {
        const pieces = filtered.filter((p) => p.category === category.id)
        const years = pieces.map((p) => p.year)
        const lo = Math.min(...years)
        const hi = Math.max(...years)
        return {
          category,
          pieces,
          range: lo === hi ? `${lo}` : `${lo} — ${hi}`,
        }
      })
      .filter((s) => s.pieces.length > 0)
  }, [filtered, active])

  const [hovered, setHovered] = useState<string | null>(null)

  // Filtering or switching view pulls the page out from under the pointer, and
  // a slug left behind by the old layout would dim everything in the new one.
  useEffect(() => setHovered(null), [view, active])

  /**
   * What the backdrop is showing.
   *
   * Held separately from `hovered` so the picture has something to fade *out*
   * of. Clearing the hover unmounts the layer through `AnimatePresence`, and
   * an exiting layer still needs its source for the half-second it takes to
   * go.
   */
  const hoveredPiece = hovered
    ? filtered.find((p) => p.slug === hovered)
    : undefined
  const [backdrop, setBackdrop] = useState<Performance | null>(null)
  useEffect(() => {
    if (hoveredPiece) setBackdrop(hoveredPiece)
  }, [hoveredPiece])

  // Stable, so the memoised frames survive a hover on one of their neighbours.
  const open = useCallback(
    (piece: Performance, el: HTMLElement) =>
      zoomTo(el, piece.poster, piece.title, `/work/${piece.slug}`),
    [zoomTo],
  )

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const categoryOptions = useMemo<readonly SegmentedOption<Filter>[]>(
    () => [
      { value: 'all', label: 'All' },
      ...CATEGORIES.map((c) => ({
        value: c.id as Filter,
        label: c.short ?? c.label,
      })),
    ],
    [],
  )

  const backdropSrc = backdrop
    ? (backdrop.previewSrc ?? backdrop.videoSrc)
    : undefined

  return (
    <div className="relative min-h-screen bg-void">
      {/* The page has no visible title — the reference opens on empty black
          and the first thing on it is work. Screen readers still need to be
          told what they have arrived at. */}
      <h1 className="sr-only">Work — the archive</h1>

      {/* The section keys.

          Centred in the top bar on a wide screen, exactly as the reference has
          them, and parked just under it below ~1560px, where seven category
          names no longer clear the site name on one side and the nav links on
          the other. The wrapper takes no pointer events so it cannot swallow
          clicks meant for the page across the full width it spans. */}
      <div className="pointer-events-none fixed top-[86px] left-1/2 z-50 w-full -translate-x-1/2 px-4 min-[1560px]:top-[22px]">
        {/* `safe center` so the keys stay centred when they fit and stay
            *reachable* when they do not — plain centring parks the overflow
            past the left edge with no way to scroll back to it. The fade on
            the right lands on empty space at any width where the whole set
            fits, and only shows up as an edge once there is something past
            it. */}
        <div className="no-scrollbar pointer-events-none flex overflow-x-auto [justify-content:safe_center] [mask-image:linear-gradient(to_right,#000_0%,#000_calc(100%-3rem),transparent_100%)]">
          <Segmented
            className="pointer-events-auto"
            options={categoryOptions}
            value={active}
            onChange={(v) => setParam('category', v === 'all' ? null : v)}
            label="Filter the archive by category"
          />
        </div>
      </div>

      {/* The hovered piece, playing behind the list.

          List view is text on black, so there is nowhere for a preview to go
          but underneath all of it. Held at a little over half strength with a
          scrim on top: any brighter and the lit row stops being the brightest
          thing on the page, which is the entire point of dimming the rest. */}
      <AnimatePresence>
        {view === 'list' && hovered && backdrop && (
          <motion.div
            key={backdrop.slug}
            className="pointer-events-none fixed inset-0 z-0"
            initial={{ opacity: 0, scale: 1.035 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="absolute inset-0 opacity-40">
              <img
                src={mediaUrl(backdrop.poster)}
                alt=""
                className="h-full w-full object-cover"
              />
              {!reduced && backdropSrc && (
                <LoopingPreview
                  src={mediaUrl(backdropSrc)!}
                  poster={mediaUrl(backdrop.poster)}
                />
              )}
            </div>
            {/* Darkest at the edges, where the nav and the keys sit. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(115% 88% at 50% 44%, rgba(17,17,17,0.30) 0%, rgba(17,17,17,0.66) 60%, rgba(17,17,17,0.93) 100%)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* The reference opens on roughly a third of a screen of nothing before
          the first entry. It is not dead space — it is what makes the archive
          read as something you descend into rather than a table. */}
      <div className="relative z-10 pt-[max(10rem,32vh)] pb-40">
        {view === 'list' ? (
          <div onMouseLeave={() => setHovered(null)}>
            {filtered.map((p) => {
              const { lead, tail } = splitTitle(p.title)
              const c = CATEGORY_MAP[p.category]
              const name = c.short ?? c.label
              const other = hovered !== null && hovered !== p.slug
              return (
                <Link
                  key={p.slug}
                  to={`/work/${p.slug}`}
                  onMouseEnter={() => setHovered(p.slug)}
                  onFocus={() => setHovered(p.slug)}
                  onBlur={() => setHovered(null)}
                  // Edge to edge, with the rule running the full width of the
                  // screen and only the type inset — the reference's ruling,
                  // and what keeps the list flush with the grid's frames.
                  className={`block border-b ${
                    // Once a picture is up, the one surviving rule underlines
                    // the row it belongs to. Leaving all thirty-six at full
                    // strength lays a ladder across the footage.
                    hovered === p.slug ? 'on-scrim' : ''
                  }`}
                  style={{
                    borderColor: other
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(255,255,255,0.11)',
                    transition: 'border-color 500ms ease-out',
                  }}
                >
                  <div className={`${GUTTER} py-2.5 md:py-3`}>
                    <IndexRow
                      as="h2"
                      lead={lead}
                      tail={tail}
                      category={name}
                      meta={p.runtime ? `${p.year} · ${p.runtime}` : `${p.year}`}
                      subline={`${name} — ${p.year}`}
                      dim={other}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div>
            {sections.map((s, si) => (
              <section key={s.category.id} className="mb-12 md:mb-16">
                <div className={`${GUTTER} pb-3 md:pb-4`}>
                  <IndexRow
                    as="h2"
                    lead={s.category.short ?? s.category.label}
                    category={`${s.pieces.length} ${
                      s.pieces.length === 1 ? 'piece' : 'pieces'
                    }`}
                    meta={s.range}
                    subline={`${s.pieces.length} pieces · ${s.range}`}
                    // The band under the pointer keeps its heading lit; every
                    // other heading goes down with the rest of the page.
                    dim={
                      hovered !== null &&
                      !s.pieces.some((p) => p.slug === hovered)
                    }
                  />
                </div>

                {/* Four across, cut to the edges of the screen, with the
                    hairline of ground between them that the reference has
                    instead of a gutter. Leaving the band is what clears the
                    hover — the gaps belong to the band, so crossing one on
                    the way to the next frame never flickers the page back to
                    full brightness.

                    The two gaps are deliberately different sizes. Sideways it
                    is the reference's 3px hairline, because four frames across
                    read as one strip and a real gutter would break it into
                    four pictures. Downwards it is a proper rule of space: the
                    reference never wraps — every piece there is exactly one
                    row of four under its own title — so a band of eleven is
                    ours to shape, and on 3px the rows fuse into a slab with no
                    way to tell where one line of work ends. Wide enough to
                    separate the rows, still well short of the 48/64px between
                    the bands themselves, so the band stays one thing. Bands of
                    four or fewer never wrap, so this costs them nothing. */}
                <div
                  className="grid grid-cols-2 gap-x-[3px] gap-y-4 sm:grid-cols-3 md:gap-y-6 xl:grid-cols-4"
                  onMouseLeave={() => setHovered(null)}
                >
                  {s.pieces.map((p, i) => (
                    <WorkFrame
                      key={p.slug}
                      piece={p}
                      active={hovered === p.slug}
                      dimmed={hovered !== null && hovered !== p.slug}
                      eager={si === 0 && i < 4}
                      onEnter={setHovered}
                      onOpen={open}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!filtered.length && (
          <p className={`${GUTTER} mono-label py-24 text-center text-[0.625rem] text-white/40`}>
            Nothing filed under this category yet.
          </p>
        )}
      </div>

      {/* The view key, floating at the foot of the screen — the one control
          that is always within reach however far down the archive you are. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <Segmented
          className="pointer-events-auto"
          options={VIEW_OPTIONS}
          value={view}
          onChange={(v) => setParam('view', v === 'grid' ? null : v)}
          label="Choose how the archive is laid out"
        />
      </div>
    </div>
  )
}
