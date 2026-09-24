import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useEdit } from '@/edit/EditProvider'
import type { ContentPath } from '@/lib/contentStore'

/**
 * How long a keystroke waits before it reaches the store.
 *
 * Not for the field's own sake — the browser has already drawn the character,
 * because React does not own the text inside a contentEditable (see below). It
 * is for everything *else* on the page: a write to the store re-renders every
 * component reading the content, and on the index that includes a three-
 * dimensional gallery. A tenth of a second collapses a burst of typing into one
 * of those, and is short enough that a name being typed in the footer still
 * looks live in the navigation above it.
 *
 * Blur flushes immediately, so nothing can be lost by leaving a field.
 */
const KEYSTROKE_SETTLE_MS = 110

/**
 * Controls that swallow a mousedown before the caret can be placed.
 *
 * Some of these fields live inside a link or a button — a nav key, a filter
 * chip, a shelf tab, the mailto in the footer. Clicking a word inside one of
 * those focuses the control and never places a caret, so the field looks broken.
 * `placeCaret` below is the workaround, and this is the test for when it is
 * needed — because the workaround costs something, and is not applied anywhere
 * it is not.
 */
const SWALLOWS_CLICKS = 'a, button, [role="tab"], label, summary'

/**
 * Put the caret where the pointer was, inside `el`.
 *
 * Only used inside those controls, because preventing the browser's own
 * mousedown is what makes it possible — and the browser's own mousedown is also
 * what gives a field drag-to-select and double-click-to-select-a-word. Paying
 * that for every field would make editing a paragraph worse in order to make
 * editing a nav label possible at all.
 *
 * The two APIs are the same idea under two names: `caretRangeFromPoint` is
 * Chrome and Safari, `caretPositionFromPoint` is the standardised one Firefox
 * has.
 */
function placeCaret(el: HTMLElement, x: number, y: number) {
  el.focus()
  const selection = window.getSelection()
  if (!selection) return

  type WithCaretRange = Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null
  }
  const doc = document as WithCaretRange

  let range: Range | null = null
  if (typeof doc.caretRangeFromPoint === 'function') {
    range = doc.caretRangeFromPoint(x, y)
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(x, y)
    if (position) {
      range = document.createRange()
      range.setStart(position.offsetNode, position.offset)
    }
  }

  // Nothing under the pointer that can hold a caret, or a browser with neither
  // API: land at the end of the field rather than nowhere.
  if (!range || !el.contains(range.startContainer)) {
    range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
  }
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/**
 * A string on the page that is also the field holding it.
 *
 * The thing to understand about this component is what it renders when nobody
 * is editing: the string, and nothing else. No wrapper, no span, no class, no
 * listener. A visitor's page is byte-for-byte the page it was before any of
 * this existed, which is the only way an editor that reaches into every
 * heading on the site can be safe to put into every heading on the site.
 *
 * In edit mode it becomes a `contentEditable` span, and the two rules below are
 * what make that work rather than fight React.
 *
 * ### The text is never rendered as children
 *
 * React must not own the text inside a contentEditable element. If the value
 * were a child, every keystroke would re-render the span and React would
 * rewrite the text node — collapsing the selection to the start of it on every
 * letter. So the element is rendered empty and its text is set imperatively,
 * and only when it is not focused. React manages the element; the browser
 * manages the words inside it.
 *
 * ### Typing writes to the store, not to state
 *
 * `set` puts the value straight into the content store, which every component
 * reading it subscribes to. So editing the name in the footer changes it in the
 * nav in the same frame, and there is no local copy of the string anywhere that
 * could disagree with the one that will be published.
 */
export function EditableText({
  path,
  value,
  placeholder,
  multiline = false,
  className = '',
  title,
}: {
  path: ContentPath
  value: string
  /** Shown in place of an empty field, so it can still be clicked. */
  placeholder?: string
  /** Enter inserts a line break instead of finishing the edit. */
  multiline?: boolean
  className?: string
  /** The tooltip. Defaults to naming the field, which is usually enough. */
  title?: string
}) {
  const { editing, set, commit } = useEdit()
  const ref = useRef<HTMLSpanElement>(null)
  /** The value as it was when the edit began, for Escape. */
  const entryRef = useRef(value)
  const settleRef = useRef<number | null>(null)

  /** Send what is in the element to the store, after the typing settles. */
  const push = useCallback(
    (immediate = false) => {
      const text = ref.current?.textContent ?? ''
      if (settleRef.current !== null) {
        window.clearTimeout(settleRef.current)
        settleRef.current = null
      }
      if (immediate) {
        commit(path, text)
        return
      }
      settleRef.current = window.setTimeout(() => {
        settleRef.current = null
        set(path, text)
      }, KEYSTROKE_SETTLE_MS)
    },
    // `path` is a fresh array on every render at most call sites, so it is
    // joined rather than depended on — the identity changes, the value does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, set, path.join('\u0000')],
  )

  // A pending keystroke must not be lost to an unmount — a navigation, or edit
  // mode being switched off with the caret still in a field.
  useEffect(
    () => () => {
      if (settleRef.current !== null) window.clearTimeout(settleRef.current)
    },
    [],
  )

  // Push the value in whenever it changes from outside — a discard, a publish,
  // an edit to the same field in the panel — but never while the caret is in
  // here, because then the value came *from* here.
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.textContent !== value) el.textContent = value
  }, [value, editing])

  if (!editing) return <>{value}</>

  return (
    <span
      ref={ref}
      role="textbox"
      // A multi-line field says so, and a single-line one does not: it is what
      // tells assistive technology whether Enter will do something.
      aria-multiline={multiline || undefined}
      aria-label={title ?? fieldLabel(path)}
      title={title ?? fieldLabel(path)}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder ?? 'Empty'}
      className={`edit-field ${multiline ? 'whitespace-pre-wrap' : ''} ${className}`}
      style={{
        // The site's own typography is inherited; only the two things that
        // would break a contentEditable are set. `min-width` is so an empty
        // field is still a target, and the break rules stop a long value in a
        // tight column from overflowing its box while it is being typed.
        minWidth: '1.5ch',
        overflowWrap: 'anywhere',
      }}
      // Only inside a control that would otherwise eat the click: everywhere
      // else the browser's own mousedown is left alone, because it is what
      // gives the field drag-to-select and double-click-to-select-a-word.
      onMouseDown={(e) => {
        const el = ref.current
        if (!el || e.button !== 0) return
        if (!el.closest(SWALLOWS_CLICKS)) return
        e.preventDefault()
        e.stopPropagation()
        placeCaret(el, e.clientX, e.clientY)
      }}
      // Dragging text out of a field inside an anchor starts a link drag in
      // every browser, which is never what was meant by it.
      onDragStart={(e) => e.preventDefault()}
      onFocus={() => {
        entryRef.current = ref.current?.textContent ?? value
      }}
      onInput={() => push()}
      onBlur={() => push(true)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          // Put the old value back *in the element* before blurring, or the blur
          // flushes the value being abandoned. Cancelling the pending write is
          // part of the same move.
          if (settleRef.current !== null) {
            window.clearTimeout(settleRef.current)
            settleRef.current = null
          }
          if (ref.current) ref.current.textContent = entryRef.current
          set(path, entryRef.current)
          ref.current?.blur()
          return
        }
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault()
          ref.current?.blur()
          return
        }
        if (e.key === 'Enter' && multiline && !e.shiftKey) {
          // The browser's own Enter in a contentEditable inserts a <div> or a
          // <br> depending on which browser it is, and either one puts markup
          // into a value that is supposed to be a string.
          e.preventDefault()
          insertPlainText('\n')
          push()
        }
      }}
      onPaste={(e) => {
        // The clipboard is usually carrying styled HTML from somewhere else.
        // Without this, pasting a sentence from a document pastes its font.
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        insertPlainText(multiline ? text : text.replace(/\s*\n\s*/g, ' '))
        push(true)
      }}
      // A link that is also a field cannot be both on one click, and the field
      // is what edit mode is for.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) e.preventDefault()
      }}
    />
  )
}

/** Insert text at the caret, leaving the document's undo stack intact. */
function insertPlainText(text: string) {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return
  const range = selection.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/**
 * "About ▸ headline ▸ 1" — the path, as a person would say it.
 *
 * Every field on the page gets a tooltip and a screen-reader label from this,
 * so an editor can always tell what they have their caret in. It is derived
 * rather than written per call site: three hundred hand-written labels would be
 * three hundred chances for one to be wrong about where its value goes.
 */
export function fieldLabel(path: ContentPath): string {
  return path
    .map((segment) =>
      typeof segment === 'number'
        ? String(segment + 1)
        : segment
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/^./, (c) => c.toUpperCase()),
    )
    .join(' ▸ ')
}

/**
 * A number on the page that is also its field.
 *
 * Kept separate from `EditableText` rather than given to it as a flag: the
 * value is a number at both ends, a half-typed number is not one, and the
 * rounding rules are different for a year and for a duration in seconds.
 */
export function EditableNumber({
  path,
  value,
  className = '',
  format,
  integer = true,
}: {
  path: ContentPath
  value: number
  className?: string
  /** How to show it when it is not being edited. */
  format?: (v: number) => ReactNode
  integer?: boolean
}) {
  const { editing, set, commit } = useEdit()
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    const text = String(value)
    if (el.textContent !== text) el.textContent = text
  }, [value, editing])

  if (!editing) return <>{format ? format(value) : value}</>

  const parse = (text: string) => {
    const n = integer ? parseInt(text, 10) : parseFloat(text)
    // An unparseable box keeps the last good value rather than becoming NaN,
    // which would render as "NaN" on the page and serialise into the content.
    return Number.isFinite(n) ? n : value
  }

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={fieldLabel(path)}
      title={fieldLabel(path)}
      contentEditable
      suppressContentEditableWarning
      inputMode={integer ? 'numeric' : 'decimal'}
      className={`edit-field ${className}`}
      style={{ minWidth: '2ch' }}
      onInput={() => set(path, parse(ref.current?.textContent ?? ''))}
      onBlur={() => {
        const next = parse(ref.current?.textContent ?? '')
        if (ref.current) ref.current.textContent = String(next)
        commit(path, next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ref.current?.blur()
        }
      }}
      onPaste={(e) => {
        e.preventDefault()
        insertPlainText(e.clipboardData.getData('text/plain').replace(/[^\d.-]/g, ''))
        set(path, parse(ref.current?.textContent ?? ''))
      }}
    />
  )
}
