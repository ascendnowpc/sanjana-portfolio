import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useEdit } from '@/edit/EditProvider'
import { fieldLabel } from '@/components/edit/Editable'
import { MediaDialog, type MediaTarget } from '@/components/edit/MediaDialog'

/**
 * What to call a field that has not been given a name.
 *
 * Both components below are only ever used in path mode, but `MediaTarget` also
 * has a callback mode for the panel, where there is no path to read a name out
 * of — so the kind is the fallback rather than a non-null assertion that would
 * be wrong the first time somebody reused this.
 */
function describe(target: MediaTarget): string {
  return target.path ? fieldLabel(target.path) : target.kind
}

/**
 * The affordance over a picture, a film or a recording.
 *
 * Dropped in as a *sibling* of the media it stands over rather than a wrapper
 * around it, and that is the whole design: wrapping an `<img>` that is
 * object-covering a 4:5 frame, or a `<video>` inside a scroll-driven stage,
 * means putting a new box into a layout that was built without one. This adds
 * nothing to the layout — it is `absolute inset-0` inside the frame that is
 * already there, and it does not exist at all unless somebody is editing.
 *
 * It is invisible until the pointer is over the frame (see `.edit-media-overlay`
 * in index.css), because the still underneath is the thing being judged.
 */
export function MediaEdit({
  target,
  className = '',
  label,
}: {
  target: MediaTarget
  /** Positioning overrides, for a frame that is not simply `inset-0`. */
  className?: string
  /** The word on the button. Defaults to the field's own name. */
  label?: string
}) {
  const { editing } = useEdit()
  const [open, setOpen] = useState(false)

  if (!editing) return null

  const name = label ?? target.label ?? describe(target)

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`Replace ${name}`}
        className={`edit-media-overlay absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center gap-1 ${className}`}
      >
        <span className="rounded-sm border border-sky-300/70 bg-sky-400/15 px-3 py-1.5 text-[0.6rem] tracking-[0.2em] text-white uppercase backdrop-blur-sm">
          Replace
        </span>
        <span className="max-w-full truncate px-2 text-[0.6rem] tracking-[0.14em] text-white/70 uppercase">
          {name}
        </span>
      </button>

      {/* Through a portal, because a `fixed` dialog inside an ancestor that
          framer-motion has given a transform is not fixed to the viewport at
          all — it is fixed to that ancestor, which on this site means a dialog
          that scrolls away with a parallax band. */}
      {open &&
        createPortal(
          <MediaDialog target={target} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  )
}

/**
 * A media field with nothing to sit on top of.
 *
 * The overlay above needs a frame. Some media on this site has none to speak
 * of — the About page's looping film is a background, the index's house audio is
 * not visible at all — so those get a small button placed by the call site
 * instead, in the same language as the rest of the editing chrome.
 */
export function MediaEditButton({
  target,
  label,
  className = '',
}: {
  target: MediaTarget
  label?: string
  className?: string
}) {
  const { editing } = useEdit()
  const [open, setOpen] = useState(false)

  if (!editing) return null

  const name = label ?? target.label ?? describe(target)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-sm border border-sky-300/70 bg-sky-400/15 px-3 py-1.5 text-[0.6rem] tracking-[0.18em] text-white uppercase backdrop-blur-sm transition-colors hover:bg-sky-400/30 ${className}`}
      >
        {name}
      </button>
      {open &&
        createPortal(
          <MediaDialog target={target} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  )
}
