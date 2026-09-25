import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  PILL,
  TOOL_ADD,
  TOOL_BTN,
  TOOL_DANGER,
  TOOL_LABEL,
  TOOL_QUIET,
} from '@/components/edit/chrome'

/**
 * One toolbar, for the entry the pointer is on.
 *
 * ### Why one and not one each
 *
 * Every list entry on the site used to carry its own set of controls, drawn
 * whether or not anybody was pointing at it. At four small squares that was
 * survivable. At the size a control has to be to say `Delete` on it in words
 * it is not: the About page's headline alone would wear three toolbars at
 * once, over the words they edit, and a page with a dozen editable entries
 * stops being a page at all.
 *
 * So the controls moved to where MCIL's are — a single toolbar, `fixed` to the
 * window, showing the entry under the pointer and nothing else. It costs the
 * page no layout at all, which is the constraint this site's editing chrome
 * has always been held to, and it means a toolbar can be as wide as its words
 * need rather than as narrow as the tightest call site allows.
 *
 * ### How an entry offers itself
 *
 * `ItemControls` renders a marker of no size and registers what to do with it
 * here; this watches its parent — the element the call site put the marker
 * inside, which is the entry — and shows the bar over it while the pointer is
 * there. Nothing else in the tree has to know.
 */

export type ItemActions = {
  /** The list's own name, singular: "Portrait", "Section", "Still". */
  label: string
  index: number
  count: number
  move: (delta: number) => void
  /** Absent when the list does not take new entries from the page. */
  add?: () => void
  remove: () => void
}

/**
 * An entry offering itself.
 *
 * The actions come through a getter rather than as a value: the entry
 * re-renders while the pointer is on it (a keystroke in the word it holds, a
 * sibling deleted), and the bar has to act on the list as it is now, not as it
 * was when the pointer arrived.
 */
type Anchor = { el: HTMLElement; get: () => ItemActions }

/* -------------------------------------------------------------- the store */

let current: Anchor | null = null
/* Bumped on every change, including a refresh that leaves `current` the same
   object — `useSyncExternalStore` compares snapshots by identity, so without
   this a renumbered entry would never reach the screen. */
let version = 0
const listeners = new Set<() => void>()

function emit() {
  version += 1
  for (const listener of listeners) listener()
}

/**
 * Show the bar on `anchor`.
 *
 * An entry inside another entry — a still inside a gallery — wins over the one
 * that contains it: the pointer is on both, and the inner one is the smaller,
 * more specific claim. Without this the gallery's bar would sit over a still
 * and move the wrong thing.
 */
export function showItemBar(anchor: Anchor) {
  if (current && current.el !== anchor.el && anchor.el.contains(current.el)) {
    return
  }
  current = anchor
  emit()
}

export function hideItemBar(el: HTMLElement) {
  if (current?.el !== el) return
  current = null
  emit()
}

/** Redraw the bar if it is showing this entry. */
export function refreshItemBar(el: HTMLElement) {
  if (current?.el === el) emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function useAnchor(): Anchor | null {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
  return current
}

/* ---------------------------------------------------------------- the bar */

export function ItemBar() {
  const anchor = useAnchor()
  const [box, setBox] = useState<DOMRect | null>(null)
  /** Kept so the bar does not vanish in the gap between entry and toolbar. */
  const leaving = useRef<number | null>(null)

  const el = anchor?.el ?? null

  /**
   * Follow the entry.
   *
   * Measured on every scroll and resize rather than once, because this site
   * moves under the pointer — parallax bands, a scroll-driven stage, a shelf
   * that travels sideways — and a toolbar that stayed where the entry used to
   * be would act on something the editor is no longer looking at.
   */
  useEffect(() => {
    if (!el) {
      setBox(null)
      return
    }
    const measure = () => setBox(el.getBoundingClientRect())
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [el])

  useEffect(
    () => () => {
      if (leaving.current) window.clearTimeout(leaving.current)
    },
    [],
  )

  if (!anchor || !box) return null
  const actions = anchor.get()

  /* Above the entry where there is room between it and the top of the window,
     and below it where there is not.
     Never *inside* it: an entry small enough to leave no room above is small
     enough that a bar laid over it would cover its neighbours, and a nav link
     you cannot point at because the last link's toolbar is on top of it is
     worse than no toolbar at all. */
  const above = box.top > 64
  const top = above ? box.top - 38 : box.bottom + 6
  /* Hung from whichever side of the entry is nearer the middle of the window,
     so it never runs off the edge. */
  const fromLeft = box.left < window.innerWidth / 2
  const place = fromLeft
    ? { left: Math.max(8, box.left) }
    : { right: Math.max(8, window.innerWidth - box.right) }

  return createPortal(
    <div
      className={`edit-chrome fixed flex items-center gap-0.5 p-1 whitespace-nowrap ${PILL}`}
      style={{ top, ...place }}
      onPointerEnter={() => {
        if (leaving.current) window.clearTimeout(leaving.current)
      }}
      onPointerLeave={() => hideItemBar(anchor.el)}
      // The entry underneath is often a link or a field; a click meant for the
      // toolbar must not also reach it.
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className={TOOL_LABEL}>
        {actions.label} {actions.index + 1}/{actions.count}
      </span>
      <button
        type="button"
        className={`${TOOL_BTN} ${TOOL_QUIET}`}
        title={`Move this ${actions.label.toLowerCase()} earlier`}
        aria-label={`Move this ${actions.label.toLowerCase()} earlier`}
        disabled={actions.index === 0}
        onClick={() => actions.move(-1)}
      >
        ◀
      </button>
      <button
        type="button"
        className={`${TOOL_BTN} ${TOOL_QUIET}`}
        title={`Move this ${actions.label.toLowerCase()} later`}
        aria-label={`Move this ${actions.label.toLowerCase()} later`}
        disabled={actions.index >= actions.count - 1}
        onClick={() => actions.move(1)}
      >
        ▶
      </button>
      {actions.add && (
        <button
          type="button"
          className={`${TOOL_BTN} ${TOOL_ADD}`}
          onClick={actions.add}
        >
          + Add {actions.label.toLowerCase()}
        </button>
      )}
      <button
        type="button"
        className={`${TOOL_BTN} ${TOOL_DANGER}`}
        onClick={actions.remove}
      >
        Delete
      </button>
    </div>,
    document.body,
  )
}
