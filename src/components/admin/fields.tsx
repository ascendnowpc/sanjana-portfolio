import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { mediaUrl } from '@/lib/media'
import type { DeriveKind, MediaResult } from '@/components/edit/MediaDialog'
import { MediaDialog } from '@/components/edit/MediaDialog'
import type { MediaKind } from '@/lib/uploads'

/**
 * The panel's form vocabulary.
 *
 * Every editor on /admin is built out of these seven, which is what keeps a
 * hundred-odd fields from becoming a hundred-odd layouts. They are deliberately
 * plain: a label, a control, and a hint when the value needs explaining. The
 * site they edit is the thing that is supposed to look designed.
 *
 * All of them are controlled and none of them holds state. The panel owns one
 * draft object and passes slices of it down, so "what is in this box" and
 * "what will be saved" can never be two different answers.
 */

const CONTROL =
  'w-full rounded-sm border border-white/12 bg-black/35 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-white/45'

/**
 * The panel's buttons, in words rather than in letterspaced capitals.
 *
 * Small caps at 0.62rem read as decoration; a control that decides whether a
 * row is deleted should read as a sentence. These three are the whole set —
 * a quiet one, a dangerous one, and the dashed one that adds something.
 */
export const BTN =
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs ' +
  'font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30'

export const GHOST_BTN = `${BTN} text-neutral-300 hover:bg-white/10 hover:text-white`

export const DANGER_BTN = `${BTN} text-red-400 hover:bg-red-500/12 hover:text-red-300`

export const ADD_BTN =
  `${BTN} border border-dashed border-white/20 px-3 text-neutral-300 ` +
  'hover:border-white/45 hover:text-white'

function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="mb-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[0.62rem] tracking-[0.18em] text-neutral-400 uppercase"
      >
        {children}
      </label>
      {hint && (
        <p className="mt-1 text-[0.7rem] leading-snug text-neutral-500">
          {hint}
        </p>
      )}
    </div>
  )
}

interface BaseProps {
  label: string
  hint?: string
  className?: string
}

export function Text({
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono,
  className,
}: BaseProps & {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** For slugs, hex colours and paths, where character shapes matter. */
  mono?: boolean
}) {
  const id = useId()
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  )
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  rows = 4,
  className,
}: BaseProps & {
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  const id = useId()
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} resize-y leading-relaxed`}
      />
    </div>
  )
}

export function Num({
  label,
  hint,
  value,
  onChange,
  step = 1,
  className,
}: BaseProps & {
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  const id = useId()
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <input
        id={id}
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        // An empty box is 0 rather than NaN: a half-typed number must not be
        // able to put the site into a state no later keystroke can fix.
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className={CONTROL}
      />
    </div>
  )
}

export function Toggle({
  label,
  hint,
  value,
  onChange,
  className,
}: BaseProps & { value: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className={`flex items-start gap-3 ${className ?? ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-white"
      />
      <div>
        <label htmlFor={id} className="text-sm text-neutral-200">
          {label}
        </label>
        {hint && <p className="text-[0.7rem] text-neutral-500">{hint}</p>}
      </div>
    </div>
  )
}

export function Select<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  className,
}: BaseProps & {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={CONTROL}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-neutral-900">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * A hex accent, with the swatch that shows what it actually is.
 *
 * Both controls write the same value. The picker is the quick way to land in
 * the right region; the text box is the only way to paste a colour somebody
 * else chose, which on this site is the usual case.
 */
export function Color({
  label,
  hint,
  value,
  onChange,
  className,
}: BaseProps & { value: string; onChange: (v: string) => void }) {
  const id = useId()
  const valid = /^#[0-9a-fA-F]{6}$/.test(value)
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} — colour picker`}
          value={valid ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-sm border border-white/12 bg-black/35 p-1"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${CONTROL} font-mono text-xs`}
        />
      </div>
    </div>
  )
}

/**
 * A path to an image, video or audio file, with the picture beside it.
 *
 * The preview is the whole point. These values are media *keys* — the same
 * string resolves to public/ in dev and to the R2 bucket in production (see
 * lib/media.ts) — so a typo in one is invisible in the field and obvious the
 * moment the thumbnail fails to load. The box says which of those two
 * happened rather than leaving a silent broken image.
 */
export function MediaField({
  label,
  hint,
  value,
  onChange,
  kind = 'image',
  className,
  upload,
}: BaseProps & {
  value: string
  onChange: (v: string) => void
  kind?: 'image' | 'video' | 'audio'
  /**
   * Where a dropped file should go in the bucket, and what else to make of it.
   *
   * Given, the field grows an Upload button that opens the same dialog the page
   * uses (see components/edit/MediaDialog.tsx) — in its callback mode, so the
   * keys come back here and land in the panel's draft rather than going straight
   * onto the live site. A panel that wrote through would take the panel's own
   * Discard button away from whoever had just uploaded the wrong take.
   */
  upload?: {
    kind: MediaKind
    /** Which of audio / poster / preview this field's owner can hold. */
    deriveKinds?: DeriveKind[]
    /** The derived keys and measured facts, for the sibling fields. */
    onResult?: (result: MediaResult) => void
    clearable?: boolean
  }
}) {
  const id = useId()
  const resolved = mediaUrl(value)
  const [picking, setPicking] = useState(false)
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <div className="flex gap-3">
        <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-black/50">
          {!value ? (
            <span className="text-[0.6rem] text-neutral-600">empty</span>
          ) : kind === 'image' ? (
            <img
              src={resolved}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
              onLoad={(e) => {
                e.currentTarget.style.visibility = 'visible'
              }}
            />
          ) : (
            <span className="text-[0.6rem] tracking-widest text-neutral-500 uppercase">
              {kind}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/media/posters/example.jpg"
            className={`${CONTROL} font-mono text-xs`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {upload && (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className={ADD_BTN}
              >
                {value ? 'Replace' : 'Upload'}
              </button>
            )}
            {/* Clearing is a keystroke away in the box beside it, but only if
                you know the box is the value. The button says so. */}
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className={GHOST_BTN}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Through a portal: the panel's fields sit inside scrolling, clipping
          containers, and a dialog is neither. */}
      {upload &&
        picking &&
        createPortal(
          <MediaDialog
            target={{
              kind: upload.kind,
              label,
              value,
              clearable: upload.clearable,
              deriveKinds: upload.deriveKinds,
              onResult: (result) => {
                onChange(result.key)
                upload.onResult?.(result)
              },
            }}
            onClose={() => setPicking(false)}
          />,
          document.body,
        )}
    </div>
  )
}

/**
 * A list of plain strings — bio paragraphs, training lines, gallery stills.
 *
 * Add, remove and reorder, with no way to end up holding a list whose items
 * have lost their order. `rows` turns each entry into a textarea, which is the
 * difference between editing a link label and editing a paragraph of prose.
 */
export function StringList({
  label,
  hint,
  items,
  onChange,
  rows,
  addLabel = 'Add',
  media,
  upload,
}: {
  label: string
  hint?: string
  items: string[]
  onChange: (next: string[]) => void
  rows?: number
  addLabel?: string
  /** Render each row as a media field with a preview. */
  media?: 'image' | 'video' | 'audio'
  /** Where a dropped file goes, when these rows are uploadable media keys. */
  upload?: MediaKind
}) {
  const set = (i: number, v: string) =>
    onChange(items.map((item, j) => (j === i ? v : item)))
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))
  const move = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div>
      <p className="mb-1.5 text-[0.62rem] tracking-[0.18em] text-neutral-400 uppercase">
        {label}
      </p>
      {hint && (
        <p className="mb-2 text-[0.7rem] leading-snug text-neutral-500">
          {hint}
        </p>
      )}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {media ? (
                <MediaField
                  label={`${label} ${i + 1}`}
                  value={item}
                  onChange={(v) => set(i, v)}
                  kind={media}
                  upload={upload ? { kind: upload } : undefined}
                />
              ) : rows ? (
                <textarea
                  rows={rows}
                  value={item}
                  onChange={(e) => set(i, e.target.value)}
                  aria-label={`${label} ${i + 1}`}
                  className={`${CONTROL} resize-y leading-relaxed`}
                />
              ) : (
                <input
                  type="text"
                  value={item}
                  onChange={(e) => set(i, e.target.value)}
                  aria-label={`${label} ${i + 1}`}
                  className={CONTROL}
                />
              )}
            </div>
            <RowControls
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onRemove={() => remove(i)}
              disableUp={i === 0}
              disableDown={i === items.length - 1}
            />
          </div>
        ))}
      </div>
      {!items.length && (
        <p className="rounded-sm border border-dashed border-white/10 px-4 py-5 text-center text-xs text-neutral-600">
          Nothing here yet.
        </p>
      )}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className={`${ADD_BTN} mt-2`}
      >
        + {addLabel}
      </button>
    </div>
  )
}

/**
 * Up / down / copy / delete, in the one shape every list in the panel uses.
 *
 * `what` names the thing in the confirmation, because "Delete?" asked over a
 * list of thirty-six is not a question anybody can answer. Passing nothing
 * removes without asking, which is right for a single line of text and wrong
 * for anything that took a minute to fill in.
 */
export function RowControls({
  onUp,
  onDown,
  onCopy,
  onRemove,
  disableUp,
  disableDown,
  what,
}: {
  onUp: () => void
  onDown: () => void
  onCopy?: () => void
  onRemove: () => void
  disableUp?: boolean
  disableDown?: boolean
  what?: string
}) {
  const icon =
    'h-7 w-7 shrink-0 cursor-pointer rounded-sm border border-white/12 text-xs text-neutral-400 transition-colors hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-25'
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onUp}
        disabled={disableUp}
        title="Move up"
        aria-label="Move up"
        className={icon}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disableDown}
        title="Move down"
        aria-label="Move down"
        className={icon}
      >
        ↓
      </button>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          title="Duplicate"
          className={GHOST_BTN}
        >
          Copy
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (
            !what ||
            confirm(`Delete “${what}”? This cannot be undone once you save.`)
          ) {
            onRemove()
          }
        }}
        title="Delete"
        className={what ? DANGER_BTN : `${icon} hover:border-red-500/60 hover:text-red-400`}
      >
        {what ? 'Delete' : '×'}
      </button>
    </div>
  )
}

/**
 * A list of objects — credits, tracks, testimonials, covers, the words of a
 * sentence.
 *
 * The caller renders one item; this owns the add / copy / remove / reorder
 * around it, so every repeating structure in the panel behaves the same way.
 * `blank` is a factory rather than a value, or every new row would share one
 * object.
 *
 * ### One row open at a time
 *
 * A list used to render every row's fields at once, which is readable at three
 * rows and a wall at thirty. Each row is now a line — its title, and a count
 * when it has a list of its own inside it — that opens on a click. Somebody
 * editing a credit is editing *that* credit; the rest are context, and context
 * belongs in a line each. The archive tab has worked this way for a while and
 * it is the reason that tab is usable; this brings the rest of the panel to it.
 *
 * A list that holds exactly one row opens it, because a row that is the whole
 * list is not hiding anything by being open.
 */
export function Repeater<T>({
  label,
  hint,
  items,
  onChange,
  blank,
  addLabel = 'Add',
  render,
  title,
  count,
  copy,
}: {
  label?: string
  hint?: string
  items: T[]
  onChange: (next: T[]) => void
  blank: () => T
  addLabel?: string
  render: (item: T, set: (next: T) => void, index: number) => ReactNode
  /** The line shown at the top of each row. */
  title?: (item: T, index: number) => string
  /** A short tally shown beside the title — "3 tracks", "2 stills". */
  count?: (item: T, index: number) => string | null
  /**
   * How to duplicate a row. Given, the row grows a Copy button.
   *
   * A factory rather than a flag because a row that carries an id cannot be
   * cloned as it stands — two cards with the same id is a worse outcome than
   * no Copy button at all, so the section that has ids mints a new one here.
   */
  copy?: (item: T, index: number) => T
}) {
  /**
   * Which row is open, by position.
   *
   * By position and not by identity because a row has no identity this
   * component can see — the items are whatever the section keeps. Every
   * reordering below moves this with the row it was following.
   */
  const [open, setOpen] = useState<number | null>(items.length === 1 ? 0 : null)

  const set = (i: number, v: T) =>
    onChange(items.map((item, j) => (j === i ? v : item)))

  const remove = (i: number) => {
    onChange(items.filter((_, j) => j !== i))
    setOpen(null)
  }

  const move = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    setOpen((current) => (current === i ? j : current === j ? i : current))
  }

  const duplicate = (i: number) => {
    const next = items.slice()
    next.splice(i + 1, 0, copy!(items[i], i))
    onChange(next)
    setOpen(i + 1)
  }

  const nameOf = (item: T, i: number) =>
    (title ? title(item, i) : '').trim() || `${label ?? 'Item'} ${i + 1}`

  return (
    <div>
      {label && (
        <p className="mb-1.5 text-[0.62rem] tracking-[0.18em] text-neutral-400 uppercase">
          {label}
        </p>
      )}
      {hint && (
        <p className="mb-3 text-[0.7rem] leading-snug text-neutral-500">
          {hint}
        </p>
      )}
      <div className="space-y-2">
        {items.map((item, i) => {
          const expanded = open === i
          const tally = count?.(item, i)
          return (
            <div
              key={i}
              className="overflow-hidden rounded-sm border border-white/10 bg-white/[0.02]"
            >
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-1 py-1 text-left"
                >
                  <span
                    aria-hidden
                    className={`shrink-0 text-neutral-500 transition-transform ${
                      expanded ? 'rotate-90' : ''
                    }`}
                  >
                    ›
                  </span>
                  <span className="truncate text-sm text-neutral-100">
                    {nameOf(item, i)}
                  </span>
                  {tally && (
                    <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[0.68rem] text-neutral-400">
                      {tally}
                    </span>
                  )}
                </button>
                <RowControls
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  onCopy={copy ? () => duplicate(i) : undefined}
                  onRemove={() => remove(i)}
                  disableUp={i === 0}
                  disableDown={i === items.length - 1}
                  what={nameOf(item, i)}
                />
              </div>

              {expanded && (
                <div className="border-t border-white/10 bg-black/20 p-4">
                  {render(item, (next) => set(i, next), i)}
                </div>
              )}
            </div>
          )
        })}
        {!items.length && (
          <p className="rounded-sm border border-dashed border-white/10 px-4 py-6 text-center text-xs text-neutral-600">
            Nothing here yet.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          onChange([...items, blank()])
          // Straight into the new row: adding one and then having to find it is
          // the step everybody forgets to take.
          setOpen(items.length)
        }}
        className={`${ADD_BTN} mt-3`}
      >
        + {addLabel}
      </button>
    </div>
  )
}

/** A titled block of fields. The panel is long; this is what makes it findable. */
export function Group({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-sm border border-white/10 bg-white/[0.015] p-5 md:p-6">
      <h3 className="text-sm tracking-[0.12em] text-white uppercase">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-2xl text-[0.78rem] leading-relaxed text-neutral-500">
          {description}
        </p>
      )}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

/** Two columns on a wide screen, one on a phone. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2">{children}</div>
}
