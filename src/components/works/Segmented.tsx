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
 * The archive's control: one dark trough holding a row of flat keys, the live
 * one white and the rest a mid grey.
 *
 * Both strips on /work are this — the category filter along the top and the
 * grid/list switch at the foot — because in the reference they are visibly
 * the same object in two places, and a second implementation would drift.
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
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex w-max items-center gap-1 rounded-[13px] bg-[#2b2b2b]/92 p-[5px] backdrop-blur-md',
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={cn(
              'mono-label rounded-[9px] px-3.5 py-2.5 text-[0.6875rem] leading-none whitespace-nowrap',
              // Dark text on both states, never light-on-dark: the trough is
              // the only dark surface in the control, and a key that borrowed
              // its colour would read as a hole rather than a key.
              'text-[#111111] transition-colors duration-300',
              on ? 'bg-white' : 'bg-[#8d8d8d] hover:bg-[#a9a9a9]',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
