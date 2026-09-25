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
 * It is a chip in the corner of the frame rather than a scrim over the whole
 * of it, and it is shown for as long as edit mode is on rather than on hover.
 * Both are the MCIL admin's answer and both are better than what was here: a
 * scrim hides the still you are judging at exactly the moment you want to look
 * at it, and an affordance that only appears under the pointer cannot tell you
 * which photographs on a page are replaceable — you have to sweep the page to
 * find out. A small white pill can sit there permanently and answer that at a
 * glance.
 *
 * The frame itself is no longer a click target. Only the chip is, which is
 * what stops a click meant for a video's own controls from opening the upload
 * dialog.
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
      {/* The box is only there to put the chip in the right corner, so it lets
          every pointer through; the chip itself takes them back. */}
      <div
        className={`edit-chrome edit-media-frame pointer-events-none absolute inset-0 z-30 flex items-start justify-start p-2 ${className}`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title={`Replace ${name}`}
          className="pointer-events-auto flex max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-lg ring-1 ring-slate-900/15 transition-colors hover:bg-white"
        >
          <PictureIcon />
          <span className="truncate">Change {name.toLowerCase()}</span>
        </button>
      </div>

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
        className={`edit-chrome flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-lg ring-1 ring-slate-900/15 transition-colors hover:bg-white ${className}`}
      >
        <PictureIcon />
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

/** The one icon the chips carry, so a pill over a photograph reads as a
    picture control before it is read as words. */
function PictureIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5-5-9 8" />
    </svg>
  )
}
