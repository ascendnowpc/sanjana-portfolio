import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Names the group for assistive tech — the keys alone don't say what they
   *  switch. */
  label: string
  className?: string
}

/**
 * The trough every control on the site sits in: a dark rounded well with a
 * grey rule drawn round it.
 *
 * Exported because the nav is built out of the same two pieces. In the
 * reference the wordmark-and-links group at the top left, the button at the
 * top right, the category filter and the grid/list switch are visibly one
 * object repeated four times, down to the radius and the rule; four separate
 * implementations of it would drift the moment any one of them was touched.
 *
 * The rule is the part that is easy to leave off and the part that does the
 * work — without it the well is a floating dark rectangle on a dark page,
 * and the control stops reading as a control.
 */
export const TROUGH =
  'flex w-max items-center gap-1 rounded-[13px] bg-[#2f2f2f]/95 p-[5px] ' +
  'ring-1 ring-[#8d8d8d]/55 backdrop-blur-md'

/**
 * One key in that trough. White when it is the live one, mid grey when it is
 * not, black lettering on both.
 *
 * Never light-on-dark: the trough is the only dark surface in the control, so
 * a key that borrowed its colour would read as a hole rather than a key.
 */
export function chip(on: boolean) {
  return cn(
    'mono-label rounded-[9px] px-3.5 py-2.5 text-[0.6875rem] leading-none whitespace-nowrap',
    'text-[#111111] transition-colors duration-300',
    on ? 'bg-white' : 'bg-[#8d8d8d] hover:bg-[#a9a9a9]',
  )
}

/**
 * The archive's control: one trough holding a row of flat keys, the live one
 * white and the rest a mid grey.
 *
 * Both strips on /work are this — the category filter along the top and the
 * grid/list switch at the foot — because in the reference they are visibly
 * the same object in two places.
 *
 * The keys are `aria-pressed` toggles rather than tabs: a tab list implies
 * panels that swap, and here the page under them is one continuous archive
 * that reorders itself.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: Props<T>) {
  return (
    <div role="group" aria-label={label} className={cn(TROUGH, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={chip(o.value === value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
