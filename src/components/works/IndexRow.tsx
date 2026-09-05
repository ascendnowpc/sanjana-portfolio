import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  /** The name, set upright. */
  lead: string
  /** The part after the dash, set italic and grey. Optional — plenty of
   *  entries are one phrase and get no second half. */
  tail?: string
  /** The middle column: which section this belongs to. Omitted by the grid's
   *  band headings, which are a name on a line and nothing else. */
  category?: string
  /** The right column — year, runtime, a count. */
  meta?: ReactNode
  /** Repeated under the title on phones, where the two columns are gone. */
  subline?: string
  /** `h2` for the grid's section headings, which really are headings; `span`
   *  for anything already inside a link or a button. */
  as?: 'h2' | 'span'
  dim?: boolean
  className?: string
}

/**
 * One line of the archive index: name on the left, section at the midpoint,
 * a little data on the right.
 *
 * The same line does both jobs in the reference — it is the whole row in list
 * view and the caption above each band in grid view — so it is one component
 * here too, and the two views cannot fall out of step.
 *
 * The columns are 2fr/1fr/1fr rather than three equal thirds because that is
 * where the reference puts them: titles run to the halfway mark, the section
 * label starts exactly at it, and the right-hand data sits in the last
 * quarter. Below `md` the two narrow columns are dropped outright — three
 * columns on a phone gives three unreadable ones — and the section label
 * comes back as a line under the title instead.
 *
 * Aligned on centres, not baselines. Baselines look like the obvious answer
 * and are what the reference appears to do, but a grid item with clipped
 * overflow reports its bottom margin edge as its baseline, so the moment the
 * title needs an ellipsis the two small columns would drop to the bottom of
 * the row. Centring is immune to that, and lands the label about ten pixels
 * above the title's baseline — which is where the reference actually sets it.
 */
export function IndexRow({
  lead,
  tail,
  category,
  meta,
  subline,
  as: Tag = 'span',
  dim = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-center gap-x-6 md:grid-cols-[2fr_1fr_1fr]',
        'transition-opacity duration-500 ease-out',
        className,
      )}
      style={{ opacity: dim ? 0.08 : 1 }}
    >
      {/* The name never truncates; only the descriptor after it does. A row
          reading "BEAUTY AND THE BEA…" has lost the one word the reader was
          scanning for, while "BEAUTY AND THE BEAST — UNDER THE…" has lost
          nothing that matters. */}
      <Tag className="flex min-w-0 items-end font-display text-[clamp(1.3rem,2.3vw,2.15rem)] leading-[1.08] font-semibold tracking-[0.01em] text-white uppercase [font-variant-numeric:lining-nums]">
        <span className="shrink-0 whitespace-nowrap">{lead}</span>
        {tail && (
          <span className="ml-[0.4em] min-w-0 truncate font-normal text-[#6e6e6e] italic">
            {tail}
          </span>
        )}
      </Tag>

      {subline && (
        <span className="mono-label mt-1.5 block text-[0.5625rem] text-white/45 md:hidden">
          {subline}
        </span>
      )}

      {/* Both are dropped from the DOM rather than rendered empty: the row is
          a three-column grid, and two empty cells still claim their tracks and
          hold the title to the left 2fr of the line. */}
      {category && (
        <span className="mono-label hidden min-w-0 truncate text-[0.625rem] text-white/70 md:block">
          {category}
        </span>
      )}

      {meta && (
        <span className="mono-label hidden min-w-0 truncate text-right text-[0.625rem] text-white/40 md:block">
          {meta}
        </span>
      )}
    </div>
  )
}

/**
 * "Beauty and the Beast — Company" -> { lead: "Beauty and the Beast",
 * tail: "Company" }.
 *
 * The archive's titles are already written as `<thing> — <which one>`, which
 * is the same shape the reference sets as upright-then-italic. Splitting on
 * the punctuation that is already there beats adding a second title field
 * nobody would keep in sync. A comma is accepted as a fallback separator
 * because a third of the entries use one for the same job ("Salon Room, Navy
 * Gown"); the dashes are tried first so a title carrying both splits at the
 * dash.
 */
export function splitTitle(title: string): { lead: string; tail?: string } {
  for (const sep of [' — ', ' – ', ' - ', ', ']) {
    const at = title.indexOf(sep)
    if (at > 0) {
      return { lead: title.slice(0, at), tail: title.slice(at + sep.length) }
    }
  }
  return { lead: title }
}
