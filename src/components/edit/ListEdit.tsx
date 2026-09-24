import { useEdit } from '@/edit/EditProvider'
import { fieldLabel } from '@/components/edit/Editable'
import type { ContentPath } from '@/lib/contentStore'

/**
 * Add, remove and reorder, for a list that is being edited where it is drawn.
 *
 * The panel has a `Repeater` for this, and it is the right shape there: rows in
 * a form, each with its controls at the end. On the page there are no rows —
 * there is a sentence made of five words, or a band of five photographs, and the
 * controls have to belong to the thing itself. So these are small, they appear
 * on hover, and the caller positions them, because only the caller knows where
 * there is room.
 *
 * Both take the path of the *list*, not of the item, and read it live. A
 * component that captured the array would reorder a stale copy.
 */
export function ItemControls({
  path,
  index,
  blank,
  className = '',
  vertical = false,
}: {
  /** The list. */
  path: ContentPath
  index: number
  /** A new, empty item, inserted after this one. Omit to hide the add button. */
  blank?: () => unknown
  className?: string
  /** Stack the buttons instead of laying them in a row. */
  vertical?: boolean
}) {
  const { editing, read, commit } = useEdit()
  if (!editing) return null

  const items = read(path)
  if (!Array.isArray(items)) return null

  const write = (next: unknown[]) => commit(path, next)

  const move = (delta: number) => {
    const to = index + delta
    if (to < 0 || to >= items.length) return
    const next = items.slice()
    ;[next[index], next[to]] = [next[to], next[index]]
    write(next)
  }

  const btn =
    'grid h-6 w-6 place-items-center rounded-sm border border-sky-300/60 bg-slate-950/85 text-[0.7rem] leading-none text-white backdrop-blur-sm transition-colors hover:bg-sky-400/40 disabled:cursor-not-allowed disabled:opacity-25'

  const name = fieldLabel([...path, index])

  return (
    <span
      className={`edit-chrome inline-flex gap-1 ${vertical ? 'flex-col' : ''} ${className}`}
      // The controls sit inside the thing they edit, which is often a link or a
      // contentEditable field. Without this, reordering a list means following a
      // link, and the click never reaches the button's own handler.
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={btn}
        aria-label={`Move ${name} earlier`}
        title={`Move ${name} earlier`}
        disabled={index === 0}
        onClick={() => move(-1)}
      >
        {vertical ? '↑' : '←'}
      </button>
      <button
        type="button"
        className={btn}
        aria-label={`Move ${name} later`}
        title={`Move ${name} later`}
        disabled={index === items.length - 1}
        onClick={() => move(1)}
      >
        {vertical ? '↓' : '→'}
      </button>
      {blank && (
        <button
          type="button"
          className={btn}
          aria-label={`Add after ${name}`}
          title={`Add after ${name}`}
          onClick={() => {
            const next = items.slice()
            next.splice(index + 1, 0, blank())
            write(next)
          }}
        >
          +
        </button>
      )}
      <button
        type="button"
        className={`${btn} hover:border-red-400/70 hover:bg-red-500/40`}
        aria-label={`Remove ${name}`}
        title={`Remove ${name}`}
        onClick={() => {
          // One list on this site is load-bearing enough to be worth a
          // question: a band of portraits with nothing in it is a hole in the
          // page. Everything else is recoverable with Discard, which the bar
          // offers as long as nothing has been published.
          if (items.length === 1 && !window.confirm(`Remove the last ${fieldLabel(path)}?`)) {
            return
          }
          write(items.filter((_, i) => i !== index))
        }}
      >
        ×
      </button>
    </span>
  )
}

/** The one button for a list that is empty, or for adding at the end of one. */
export function AddItem({
  path,
  blank,
  label,
  className = '',
}: {
  path: ContentPath
  blank: () => unknown
  label?: string
  className?: string
}) {
  const { editing, read, commit } = useEdit()
  if (!editing) return null

  const items = read(path)
  if (!Array.isArray(items)) return null

  return (
    <button
      type="button"
      onClick={() => commit(path, [...items, blank()])}
      className={`edit-chrome rounded-sm border border-sky-300/60 bg-slate-950/85 px-3 py-1.5 text-[0.6rem] tracking-[0.18em] text-white uppercase backdrop-blur-sm transition-colors hover:bg-sky-400/30 ${className}`}
    >
      + {label ?? `Add ${fieldLabel(path)}`}
    </button>
  )
}

/**
 * A quiet marker that opens the drawer on the part of the panel that edits
 * whatever region it sits in.
 *
 * There is a limit to what can be edited in place. A hex accent, the order of
 * six disciplines, which recording plays under the index, an alt text nobody can
 * see — these are fields with no visible word to click. Rather than invent an
 * inline control for each, every region of the site carries one of these, and it
 * opens the panel section that owns that region. Which is also the honest answer
 * to "everything is editable from the page": the page is the way in, and the form
 * is still there behind it for the things a page cannot show.
 */
export function RegionEdit({
  drawer,
  label,
  className = '',
}: {
  /** A section id the drawer knows — see `EditDrawer`. */
  drawer: string
  label: string
  className?: string
}) {
  const { editing, openDrawer } = useEdit()
  if (!editing) return null

  return (
    <button
      type="button"
      onClick={() => openDrawer(drawer)}
      title={`Open ${label} in the panel`}
      className={`edit-chrome rounded-sm border border-sky-300/50 bg-slate-950/80 px-3 py-1.5 text-[0.58rem] tracking-[0.2em] text-sky-100 uppercase backdrop-blur-sm transition-colors hover:border-sky-300 hover:bg-sky-400/25 ${className}`}
    >
      {label} ▸
    </button>
  )
}
