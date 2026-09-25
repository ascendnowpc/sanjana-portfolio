import { useEffect, useMemo, useRef } from 'react'
import { useEdit } from '@/edit/EditProvider'
import { PILL, TOOL_ADD, TOOL_BTN, TOOL_QUIET } from '@/components/edit/chrome'
import {
  hideItemBar,
  refreshItemBar,
  showItemBar,
  type ItemActions,
} from '@/components/edit/ItemBar'
import { fieldLabel } from '@/components/edit/Editable'
import type { ContentPath } from '@/lib/contentStore'

/**
 * Add, remove and reorder, for a list that is being edited where it is drawn.
 *
 * The panel has a `Repeater` for this, and it is the right shape there: rows in
 * a form, each with its controls at the end. On the page there are no rows —
 * there is a sentence made of five words, or a band of five photographs.
 *
 * This renders nothing you can see. It marks the element it is dropped into as
 * one entry of a list and says what may be done to it; the toolbar itself is a
 * single floating bar that follows the pointer from entry to entry (see
 * `ItemBar`). That is MCIL's arrangement and it is the one that scales: a
 * control that is only drawn for the entry under the pointer can afford to be
 * legible, and costs the page nothing when it is not.
 *
 * The call sites still choose where the marker goes, because the marker's
 * parent is the entry the bar will be hung on — put it inside the word, the
 * tile or the card that should be movable.
 *
 * It takes the path of the *list*, not of the item, and reads it live. A
 * component that captured the array would reorder a stale copy.
 */
export function ItemControls({
  path,
  index,
  blank,
  className = '',
}: {
  /** The list. */
  path: ContentPath
  index: number
  /** A new, empty item, inserted after this one. Omit to hide the add button. */
  blank?: () => unknown
  /** Kept for the call sites that position the marker; it has no size. */
  className?: string
  /**
   * @deprecated The floating bar lays itself out; there is nothing to stack.
   * Accepted so the call sites that pass it keep compiling.
   */
  vertical?: boolean
}) {
  const { editing, read, commit } = useEdit()
  const marker = useRef<HTMLSpanElement>(null)

  const items = read(path)
  const list = Array.isArray(items) ? items : null

  /* The list's own name, singular — "Portrait" out of ["profile","portraits"],
     "Section" out of ["ui","nav","sections"]. `fieldLabel` gives the whole
     breadcrumb, which is right in a tooltip and far too long on a pill. */
  const label = useMemo(() => {
    const last = [...path].reverse().find((s) => typeof s === 'string') as
      | string
      | undefined
    if (!last) return 'Item'
    const words = last
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase())
    return words.replace(/ies$/, 'y').replace(/s$/, '')
  }, [path])

  /**
   * What the bar may do to this entry, rebuilt on every render.
   *
   * Held in a ref and not in the effect below, because `blank` is an inline
   * arrow at most call sites: a new identity every render, which as an effect
   * dependency would tear the pointer listeners down and put them back while
   * the pointer was still inside the entry. No fresh `pointerenter` follows a
   * re-attach, so the bar would go out under the hand that was reaching for
   * it.
   */
  const actions = useRef<ItemActions | null>(null)
  actions.current = list
    ? {
        label,
        index,
        count: list.length,
        move: (delta) => {
          const to = index + delta
          if (to < 0 || to >= list.length) return
          const next = list.slice()
          ;[next[index], next[to]] = [next[to], next[index]]
          commit(path, next)
        },
        add: blank
          ? () => {
              const next = list.slice()
              next.splice(index + 1, 0, blank())
              commit(path, next)
            }
          : undefined,
        remove: () => {
          // One list on this site is load-bearing enough to be worth a
          // question: a band of portraits with nothing in it is a hole in the
          // page. Everything else is recoverable with Discard, which the bar
          // offers as long as nothing has been published.
          if (
            list.length === 1 &&
            !window.confirm(`Remove the last ${fieldLabel(path)}?`)
          ) {
            return
          }
          commit(
            path,
            list.filter((_, i) => i !== index),
          )
          const el = marker.current?.parentElement
          if (el) hideItemBar(el)
        },
      }
    : null

  /** Hand the entry — this marker's parent — to the bar while the pointer is on it. */
  useEffect(() => {
    const el = marker.current?.parentElement
    if (!editing || !el) return

    const enter = () => {
      if (actions.current) showItemBar({ el, get: () => actions.current! })
    }
    const leave = () => hideItemBar(el)
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
      hideItemBar(el)
    }
  }, [editing])

  /* The bar is showing this entry and the list under it just changed — a move
     that renumbered it, a sibling deleted. Tell it, or it goes on offering
     "3/5" for an entry that is now second of four. */
  useEffect(() => {
    const el = marker.current?.parentElement
    if (el && actions.current) refreshItemBar(el)
  })

  if (!editing || !list) return null

  /* No size, no layout, no paint — every visible part of this is the bar. */
  return (
    <span
      ref={marker}
      aria-hidden
      data-edit-item
      className={`pointer-events-none absolute h-0 w-0 overflow-hidden ${className}`}
    />
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
      className={`edit-chrome ${PILL} ${TOOL_BTN} ${TOOL_ADD} ${className}`}
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
      className={`edit-chrome ${PILL} ${TOOL_BTN} ${TOOL_QUIET} ${className}`}
    >
      {label} ▸
    </button>
  )
}
