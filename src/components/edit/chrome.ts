/**
 * The editing chrome's vocabulary.
 *
 * Every control that floats over the page while edit mode is on is built out
 * of these, so the bar at the foot, the toolbar on a list entry and the chip on a
 * photograph are recognisably one interface rather than three.
 *
 * The shapes are borrowed wholesale from the MCIL admin, which got two things
 * right that this site's chrome did not:
 *
 * - **Pills, and words inside them.** A control set in 0.6rem capitals at
 *   0.2em tracking reads as decoration. A rounded pill with `Delete` written
 *   on it in a legible weight reads as a button that deletes something.
 * - **Colour that means something.** Adding is green, deleting is red, the
 *   unsaved Save is amber. You can tell what a toolbar will do to your page
 *   before you have read a word of it.
 *
 * The surface stays this site's near-black rather than MCIL's navy, because
 * the chrome sits over photography that is mostly dark.
 */

/** The dark lozenge every floating toolbar is drawn on. */
export const PILL =
  'rounded-full bg-slate-950/95 shadow-xl ring-1 ring-white/15 backdrop-blur'

/** A control on that lozenge — the bar's size. */
export const PILL_BTN =
  'cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ' +
  'disabled:cursor-default disabled:opacity-40'

/** A control on that lozenge — the tighter size, for a toolbar on an entry. */
export const TOOL_BTN =
  'cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ' +
  'disabled:cursor-default disabled:opacity-35'

/** Quiet: does not change the content. */
export const TOOL_QUIET = 'text-white/85 hover:bg-white/15 hover:text-white'

/** Adds something. */
export const TOOL_ADD = 'bg-emerald-600 text-white hover:bg-emerald-500'

/** Takes something away. */
export const TOOL_DANGER = 'bg-red-600 text-white hover:bg-red-500'

/** The counter at the head of an entry's toolbar — "Portrait 2/5". */
export const TOOL_LABEL =
  'px-2 text-[10px] font-semibold tracking-[0.1em] text-white/60 uppercase tabular-nums'
