import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Performance } from '@/types/content'
import { buildCloud, DEFAULT_CLOUD, type TileLayout } from './layout'
import { GalleryTile, HOVER_SCALE, type TileRefs } from './GalleryTile'
import { usePointer } from '@/hooks/usePointer'
import { useIsMobile, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { useTransition } from '@/components/layout/TransitionProvider'
import { clamp, smoothstep } from '@/lib/utils'

/**
 * Focal length of the projection, in px.
 *
 * With a per-tile `perspective(P)`, an element pushed to translateZ(P − D)
 * sits exactly D px from the eye and is scaled by P/D — a textbook pinhole.
 * Everything below is written in those terms.
 *
 * Short, because focal length *is* the field of view: a tile lands at
 * P·tan(bearing) px from centre, so at 1400 a frame on the edge of a 1456px
 * viewport is only 27° off-axis and turns barely a tenth of the way toward
 * the eye. The reference skews its edge frames hard — one measures 210px on
 * the near edge against 340 on the far — which needs roughly 45°, and that
 * means a wide lens. Radii come down to match, since scale is P/distance.
 */
const PERSPECTIVE = 780

/**
 * The same, for a phone.
 *
 * Focal length is field of view, and a 390px-wide viewport at 780 sees a
 * 0.49rad slice of the horizon — four frames, with the rest of the catalogue
 * behind the viewer's shoulders. A shorter lens opens that to 0.8rad and fills
 * the screen. It costs nothing in size: tile widths are solved against
 * whichever focal length is in play, so the frames stay exactly as big as they
 * were asked to be and simply have company.
 */
const PERSPECTIVE_MOBILE = 460

const TAU = Math.PI * 2

/**
 * The viewer does not travel. They turn.
 *
 * Every previous version of this flew a camera forward down a tunnel of
 * pictures, with a sideways pan bolted on. Watching the reference frame by
 * frame kills that reading outright: between two frames half a second apart,
 * tiles on the *left*, in the *centre* and on the *right* all slide the same
 * direction, and none of them changes size. Forward travel would push the left
 * ones left and the right ones right, growing as they came. This is a yaw — a
 * head turning inside a room that stays put.
 *
 * So there is no travel axis any more, no wrap-around depth, no drift toward
 * the camera. There is a heading, and input changes it.
 */
/** Radians of yaw per pixel of drag. */
const YAW_PER_PX = 0.0022
/** Radians of pitch per pixel of drag. */
const PITCH_PER_PX = 0.0026
/** Radians of yaw per unit of wheel delta, so a scroll orbits the room. */
const YAW_PER_WHEEL = 0.0016
/**
 * How far the head may tip.
 *
 * Was 0.2, and 0.2 is the larger half of why the room would hardly look up or
 * down. Work hangs out to ±0.68rad and the screen covers ±0.49 of that at a
 * glance, so a ceiling of 0.2 left the top and bottom rows of the catalogue
 * permanently out of reach — the vertical axis ran out of travel almost as
 * soon as it was asked for any. At 0.38 the tip plus the half-screen the eye
 * already covers reaches 0.87rad — past the last row in both directions, so
 * everything hung in the shell can be looked at — while stopping short of
 * tipping so far that the band leaves the frame and the visitor is holding
 * their cursor against an empty ceiling.
 */
const PITCH_LIMIT = 0.38
/**
 * Steering with the cursor.
 *
 * Two things at once, and they are deliberately different things. Where the
 * pointer *is* leans the view — immediately and in proportion, the way the
 * eyes move before the head does — and how far it is held out from the middle
 * keeps the room turning for as long as it is held. The lean is what makes the
 * room answer at the speed the hand moves; the rate is what makes a room
 * bigger than one screen crossable at all. Neither alone is enough: a pure
 * lean rewinds the moment the mouse comes back to centre, and a pure rate
 * always trails the hand that asked for it.
 */
/**
 * Fraction of the half-viewport that steers nothing.
 *
 * Small now. It used to be 0.33 — a third of the screen in every direction —
 * because it was carrying a second job: hover only resolved inside it, so a
 * frame could be read only by first turning it into a window in the middle of
 * the screen, and everything outside that window was unpointable. Focus is
 * settled by the pointer *standing still* now rather than by where it stands,
 * so this is back to doing the one thing a deadzone is for: keeping a hand
 * resting near the centre from nudging the room.
 */
const STEER_DEAD = 0.1
/**
 * Radians per second of yaw at full deflection.
 *
 * Small, because holding still is not what moves the reference. Measured off
 * a recording of it, a pointer parked at 0.8 of the way to the edge turns its
 * room at about a tenth of a screen-width a second — a slow carry, there so
 * that the room is never quite stuck — and everything quick comes from
 * *moving* the pointer, which is the lean below. This was 1.45: a room that
 * raced away under a hand that had stopped, and barely answered one that
 * moved.
 */
const STEER_YAW = 0.35
/** Radians per second of pitch at full deflection. See STEER_YAW. */
const STEER_PITCH = 0.25
/**
 * The lean: how far the view turns with where the pointer is, in radians at
 * full deflection.
 *
 * This is what makes the reference fast. Moving its pointer swings the room
 * the other way by more than the pointer moved — about one and a half times,
 * horizontally, measured by phase correlation across the recording — peaking
 * at two to three and a half screen-widths a second within a tenth of a
 * second of the move and coasting to rest over the next three tenths (that
 * coast is the pointer's own smoothing, usePointer(0.13)). Averaged over the
 * recording's sweeps the room travels about 1.8 times as far as the pointer
 * sideways and 1.35 times vertically, and with this lens a lean of L moves it
 * 1.08·L times sideways and 1.9·L times vertically — so 1.65 and 0.6. These
 * were 0.3 and 0.2, about a third of a screen's swing for a full sweep of the
 * hand: a room that leaned politely where the reference's turns.
 */
const LOOK_YAW = 1.65
const LOOK_PITCH = 0.6
/**
 * The lean on a touch screen, as a share of the above.
 *
 * A finger has no hover: the pointer jumps to wherever it lands, and at the
 * full lean a tap near the edge of a phone would throw the room half a turn.
 * Dragging is how a phone turns the room; this keeps only a hint of lean.
 */
const LOOK_TOUCH = 0.2
/**
 * Furthest the view may tip, lean and all. Past this the band of frames is
 * leaving the screen and the top or bottom of it is an empty sky.
 */
const VIEW_PITCH_LIMIT = 0.6

/**
 * Deadzoned response for one steering axis.
 *
 * Smoothstep, where this used to square its input. Both are gentle at the
 * deadzone and full at the edge, but a square hands back a *quarter* of the
 * speed at half deflection — and half deflection is where a cursor actually
 * spends its time, so the room answered at a crawl everywhere it was normally
 * asked to move. Smoothstep gives half speed at half deflection and still
 * eases into both ends, so nothing steps on the way in or out.
 */
function steerAxis(v: number) {
  const a = Math.abs(v)
  if (a <= STEER_DEAD) return 0
  const t = (a - STEER_DEAD) / (1 - STEER_DEAD)
  return Math.sign(v) * t * t * (3 - 2 * t)
}

/** Ambient yaw, radians per 60fps frame — the room turning gently on its own,
 *  at about the few hundredths of a screen-width a second the reference
 *  carries when nobody is touching it. */
const DRIFT = 0.0009
/**
 * Seconds the ambient turn takes to reach full speed on arrival.
 *
 * A frame-difference trace of the reference capture shows it hold still, then
 * ramp 0.11 → 2.73 over about a second before settling. It starts *moving*
 * rather than being already in motion the instant you look at it.
 */
const SPIN_UP = 1.15

/**
 * The opening move: the room rising out of the dark a long way off, and
 * rushing in.
 *
 * Timed off the reference recording, frame by frame. It opens on black with
 * the welcome sentence already arriving; about half a second later the room
 * shows as a faint, narrow cluster at the middle of the screen — the whole
 * catalogue, far away — and closes in on the viewer, quick at first and
 * settling, over a little under three seconds. There is no wide shot held
 * before it: the pull starts the moment the room appears, and the room comes
 * up out of black while it is already moving.
 *
 * It is a walk, not a lens move. An earlier version widened the focal length
 * instead, which scales the whole picture about its centre — every frame
 * grows at the same rate and nothing passes anything. The reference is a
 * camera travelling: the near frames on the flanks stream outward and past
 * while the far ones in the middle barely change, which only a change of
 * *position* gives. So the eye starts this far behind where it comes to rest,
 * outside the shell — from there the front half of it is a bowl of frames,
 * open toward the viewer, with its walls seen edge-on: the reference's
 * corridor, far off — and travels forward into its place at the centre.
 *
 * The travel is set by how big the room *looks*, not by distance. Eased in
 * distance, nearly all of the growth lands in the last few hundred
 * milliseconds, because size goes as one over distance; eased in apparent
 * size, it grows the way the reference's does — and the way the welcome
 * sentence over it does, on the same curve, so the two arrive together.
 */
/** How big the middle of the room looks when it first shows, against at rest. */
const APPROACH_FROM = 0.16
/**
 * How far each frame's share of the approach may differ from the room's.
 *
 * Every frame hangs at about the same distance once the room has arrived,
 * which seen from far off is a thin ring — not the reference's corridor, whose
 * frames recede down it at every depth to a vanishing point. So while the eye
 * is still travelling, each frame is held back by its own multiple of the
 * remaining distance, between 1 − this and 1 + this: the room starts as a long
 * corridor of pictures, the near ones stream out past the viewer faster than
 * the far ones, and they all fold into the shell as the travel runs out.
 */
const APPROACH_STAGGER = 0.65
/** The depth that apparent size is measured at: about where the middle of
 *  the shell hangs. */
const APPROACH_DEPTH = 1000
/** Black before the room appears. The welcome sentence starts in it. */
const INTRO_DELAY_MS = 400
/** How long the pull itself takes. */
const INTRO_MS = 2700
/** Share of the pull the room takes to come up out of black. */
const INTRO_FADE = 0.45
/**
 * Held still after the pull, with the sentence still up, before the room is
 * handed over: the reference lets it land and be read before anything else
 * moves.
 */
const INTRO_SETTLE_MS = 450

/**
 * Milliseconds from the start of the intro to the handover — when the welcome
 * sentence goes and the page's own lettering arrives. Exported so the index
 * can time the sentence against the same clock.
 */
export const WELCOME_MS = INTRO_DELAY_MS + INTRO_MS + INTRO_SETTLE_MS
/** Milliseconds from the start of the intro to the end of the pull. */
export const PULL_END_MS = INTRO_DELAY_MS + INTRO_MS

/** Eased pull: quick at first, and a long settle into place. The welcome
 *  sentence's growth was measured to this same quadratic. */
function introEase(t: number) {
  return 1 - (1 - t) * (1 - t)
}

/**
 * Half-angle of the view, in radians.
 *
 * A backstop, not the real cull — that is now the projected box below, which
 * knows the actual viewport. These angles only have to sit outside any screen
 * anyone might have: at 1.34rad a frame lands 2800px from centre, past the
 * edge of a 5K display, so nothing visible is ever touched by this fade.
 *
 * They used to be 1.02/1.36, and 1.02 is exactly the edge angle of a 2560px
 * monitor — every frame along both edges of a wide display was being faded out
 * for no reason at all.
 */
const FOV_FADE = 1.34
const FOV_CULL = 1.46

/** Nearest a tile may come to the eye before it is skipped, in px. Guards the
 *  divide-by-depth: a tile at the eye projects to infinity. Only ever reached
 *  well off the side of the screen, so it can never pop in view. */
const NEAR_CLIP = 150

/** How far outside the viewport a tile's projected box may sit before it stops
 *  being drawn. Generous, so a frame is never cut while any of it could show. */
const OFFSCREEN_MARGIN = 260

/**
 * Insets on the projected box for hover, as a fraction of its size.
 *
 * Asymmetric on purpose: keeping focus allows more slop past the edge than
 * taking it does. Without that hysteresis a frame drifting under a still
 * cursor flickers on and off along its own border several times a second,
 * which is half of what read as glitching.
 *
 * The take inset used to be 0.12, which on a 300px frame is 36px of picture
 * along every edge that looked hoverable and was not — and the measured boxes
 * do not justify it. Checked against `getBoundingClientRect` over seven frames
 * across the screen, the projection this loop computes lands within 2% of the
 * rendered box horizontally and 7% vertically. The insets only have to cover
 * that, not a guess at it.
 */
const HOVER_GAIN = 0.05
const HOVER_KEEP = -0.12

/** Just under a right angle: tan() is asked for the edges of a tile's angular
 *  span, and beyond this it flips sign and the box turns inside out. */
const ANGLE_LIMIT = Math.PI / 2 - 0.02

/**
 * Pointer speed, in px/s, that separates looking at the room from moving it.
 *
 * This is what replaced "hover only works in the middle of the screen". A
 * cursor being swept across the wall to steer is travelling; a cursor that has
 * come to rest on a frame is reading it. Speed tells those apart wherever on
 * the screen they happen, which is what lets every frame be hoverable and the
 * whole screen be steerable at the same time.
 *
 * Two thresholds, not one: focus is taken only from a properly settled pointer
 * and kept through the small movements a hand makes while reading. A single
 * threshold sits exactly where a resting hand's jitter crosses it, which is a
 * frame lighting and unlighting several times a second.
 */
const FOCUS_TAKE_SPEED = 190
const FOCUS_KEEP_SPEED = 460

/**
 * Deflection past which a resting cursor is steering, not reading.
 *
 * Holding the pointer against an edge is how the room is crossed, and it is
 * held *still* while it is being done — which the speed test above, on its
 * own, would read as somebody settling down to look at whatever happens to be
 * under it, and the room would stop under a hand that is asking it to keep
 * going. So the outer fifth of the screen reads nothing and only turns.
 *
 * Note how much bigger the reading area is than the window this replaced:
 * 0.62 of the half-viewport is about 1800×1040 of a 1456×840 screen — that is
 * to say all of it bar a margin — against the 490×280 keyhole that hover used
 * to be confined to.
 */
const FOCUS_TAKE_DEFLECT = 0.8
const FOCUS_KEEP_DEFLECT = 0.9

/**
 * How far, in radians, the room may still have to swing before a frame can be
 * read.
 *
 * With the lean as strong as it is, the room goes on moving for a few tenths
 * of a second after the hand has stopped — it is catching up. Taking focus in
 * that window froze it mid-swing, a jolt where the reference coasts to rest.
 * So focus waits until the room has all but arrived where the pointer is
 * sending it.
 */
const FOCUS_SETTLE = 0.02

/**
 * Stacking order for the frame being read: above every other tile, which are
 * given 0..1000 by depth.
 */
const FOCUS_Z = 1200

/**
 * How far the rest of the room steps back while one frame is being read.
 *
 * This is the whole hover treatment now. It used to be a full-screen
 * `backdrop-filter: blur()` sheet slid between the focused tile and everything
 * else — which reads beautifully in a still screenshot and is, on a page of
 * eighty moving pictures, the single most expensive thing that could possibly
 * be asked for: every frame it must re-read the composited output of the whole
 * wall back off the GPU, blur it, and paint it again. That is most of the
 * glitching, and it bought a softness that dimming gets for free, because each
 * tile already carries a shading overlay the loop writes anyway.
 */
/** Clear air between a frame and its caption, in px. */
const CAPTION_GAP = 34
/** Roughly what a caption occupies, in px — a label, a title of a line or two
 *  and a sentence. Only used to work out which side of a frame it will fit on,
 *  so an approximation is enough. */
const CAPTION_HEIGHT = 170
/** Room left at each end of the screen. The name along the top and the links
 *  along the bottom are both centred, over exactly where a caption goes, so
 *  both are kept clear. */
const CAPTION_TOP_SAFE = 110
const CAPTION_BOTTOM_SAFE = 140

const DIM_OTHERS = 0.62
/** Ceiling on the dimming of an unfocused frame — never quite to black. */
const DIM_MAX = 0.84

/**
 * How many tiles may hold a video decoder at once.
 *
 * This used to be 72 — "every tile in frame plays" — and that is what cost the
 * wall its smoothness. A browser has a small pool of hardware video decoders;
 * past roughly a dozen concurrent streams Chrome quietly drops the rest to
 * software decode on the main thread, which is the same thread writing the
 * transforms, so the whole wall stutters. Firefox and Safari cap harder still
 * and simply refuse to start the surplus, leaving frozen tiles.
 *
 * A handful of moving frames already reads as "the whole wall is alive",
 * because the ones that get them are the nearest and largest. The rest hold
 * their poster, which at tunnel depth is indistinguishable at a glance.
 *
 * Nine rather than twelve. The frames are two-thirds the size they were, so a
 * playing one is doing two-thirds as much for the page — and the room turns
 * half again as fast now, which means more of them cross the screen per
 * second and every crossing is a decoder handed over. Nine is what that
 * budget buys at the new speed.
 */
const MAX_PLAYING = 9
const MAX_PLAYING_MOBILE = 3

/**
 * Nudge given to a tile that is already playing when ranking candidates.
 *
 * Without it, two tiles either side of the cut swap places every time the
 * ranking runs, and each swap tears down a decoder and starts a new one —
 * the most expensive thing this component can do. The bonus is small enough
 * that a genuinely nearer tile still takes the slot.
 */
const PLAY_STICKY = 0.08

/**
 * Delay, in ms, before the first decoder is handed out.
 *
 * Video elements created during first paint compete with the posters for
 * bandwidth and hold `window.load` open, which is what kept the preloader
 * pinned to its ceiling. Posters land first, the wall is interactive
 * immediately, and the footage fades in behind it a moment later.
 */
const WARMUP_MS = 900

/** Below this on-screen width a tile is too small for motion to register. */
const PLAY_MIN_WIDTH = 60

/**
 * Where the caption for the focused frame should sit.
 *
 * The caption describes one picture, and the middle of the screen is where
 * both of them want to be — so the caption is told to step out of the way,
 * and how far. Anchored to the frame's own edge rather than nudged by a fixed
 * amount: a frame sitting just off centre needs the caption moved barely at
 * all, one filling half the screen needs it moved a long way, and a single
 * constant is wrong for both.
 */
export interface CaptionAnchor {
  /** Which side of the frame the caption sits on. */
  side: 'above' | 'below'
  /** Distance in px from the matching viewport edge to the caption's own near
   *  edge: a `bottom` when the caption is above, a `top` when it is below. */
  offset: number
}

interface Props {
  performances: Performance[]
  /** Fires when the focused tile changes, so the hero copy can follow it. */
  onFocusChange?: (
    performance: Performance | null,
    anchor: CaptionAnchor,
  ) => void
  /** Fires once, at the handover — see WELCOME_MS. The index uses it to
   *  retire its welcome sentence and bring in its own lettering. */
  onIntroDone?: () => void
  /**
   * Called every frame of the intro with the milliseconds elapsed on its
   * clock, up to WELCOME_MS.
   *
   * The index uses it to grow its welcome sentence on the same clock as the
   * pull, so the words and the room move as one shot.
   */
  onIntroFrame?: (elapsed: number) => void
  /**
   * Hold the opening shot. The intro's clock does not run while this is true,
   * so a pull that would otherwise play out behind a page still loading waits
   * for it instead.
   */
  held?: boolean
  /** Open already arrived: no pull and no handover — the room as it is left
   *  once the intro is over. For a visitor coming back to the index. */
  skipIntro?: boolean
  /** Light no frame, wherever the cursor is resting — while it is over a
   *  link on the overlay, which a caption would otherwise replace. */
  suppressFocus?: boolean
}

/**
 * A shell of stage frames hung around the viewer, who turns inside it.
 *
 * The React tree renders once and then stays still: all motion is written
 * straight to `style.transform` from a single rAF loop. Tiles are placed once,
 * at a bearing and an elevation, and never move again — the loop only changes
 * where the viewer is looking, and the horizon goes round forever with no seam.
 *
 * The loop is careful about three things, and each of them was a stutter:
 *  - it measures nothing. Every frame's box on screen is computed from the
 *    same projection that produced its transform, so hover and the decoder
 *    budget never ask the DOM anything and never force a layout.
 *  - it draws only what is on screen. A frame whose projected box misses the
 *    viewport is skipped outright, which is about twenty tiles a frame rather
 *    than eighty.
 *  - it writes only what changed. Transform, opacity, z-index and shading each
 *    carry their last value, so a still room costs nothing.
 *
 * Only the nearest dozen carry live footage — see MAX_PLAYING. Everything
 * else holds a poster, which is what keeps this a wall and not a stack of
 * video decoders fighting over the main thread.
 */
export function ImmersiveGallery({
  performances,
  onFocusChange,
  onIntroDone,
  onIntroFrame,
  held = false,
  skipIntro = false,
  suppressFocus = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const registry = useRef(new Map<string, TileRefs>())

  const [hovered, setHovered] = useState<string | null>(null)
  const hoveredRef = useRef<string | null>(null)

  /** Keys of the tiles currently running footage. Mirrored in a ref so the
   *  loop can diff against it without re-subscribing. */
  const [playing, setPlaying] = useState<ReadonlySet<string>>(() => new Set())
  const playingRef = useRef<ReadonlySet<string>>(playing)

  const isMobile = useIsMobile()
  const reduced = usePrefersReducedMotion()
  const { zoomTo } = useTransition()

  const repeats = isMobile ? 2 : DEFAULT_CLOUD.repeats

  /** Whether the opening is being played at all. Decided once, on mount: a
   *  visitor who has seen it, or who has asked for less motion, gets the room
   *  as it is left afterwards. */
  const [intro] = useState(() => !reduced && !skipIntro)
  /** True once the opening pull has arrived. Gates the decoders — see below —
   *  and is what the index waits on before retiring its welcome copy. */
  const [arrived, setArrived] = useState(!intro)
  const arrivedRef = useRef(arrived)
  const onIntroDoneRef = useRef(onIntroDone)
  onIntroDoneRef.current = onIntroDone
  const onIntroFrameRef = useRef(onIntroFrame)
  onIntroFrameRef.current = onIntroFrame
  const heldRef = useRef(held)
  heldRef.current = held
  const suppressFocusRef = useRef(suppressFocus)
  suppressFocusRef.current = suppressFocus
  /** The last progress handed to `onIntroFrame`, so a finished intro stops
   *  calling it with the same number every frame. */
  const lastWelcome = useRef(-1)

  /** False until the posters have settled — see WARMUP_MS. */
  const [warm, setWarm] = useState(false)
  useEffect(() => {
    let t = 0
    const arm = () => {
      t = window.setTimeout(() => setWarm(true), WARMUP_MS)
    }
    if (document.readyState === 'complete') arm()
    else window.addEventListener('load', arm, { once: true })
    return () => {
      window.removeEventListener('load', arm)
      clearTimeout(t)
    }
  }, [])

  // Reduced-motion users get stills only: a frame full of autoplaying video is
  // precisely what that preference is asking us not to do.
  //
  // Nothing plays during the opening pull either. Every frame in the catalogue
  // is on screen while the room is wide, the transform of each is changing on
  // every one of those frames, and starting a dozen video decoders into that
  // is asking for the stutter to land on the one motion the visitor is
  // certain to watch. The footage fades in once the room has arrived.
  const maxPlaying =
    !warm || !arrived || reduced
      ? 0
      : isMobile
        ? MAX_PLAYING_MOBILE
        : MAX_PLAYING
  // Read through a ref inside the loop rather than closed over, so the loop is
  // not torn down and rebuilt the moment the budget changes — a rebuild resets
  // the loop's own clocks, and one of those now runs the opening pull.
  const maxPlayingRef = useRef(maxPlaying)
  maxPlayingRef.current = maxPlaying
  const cloud = useMemo(
    () =>
      buildCloud(performances, {
        repeats,
        // Authoritative: sizes below are given on screen, and the layout
        // solves each tile's cut width against this lens.
        focal: isMobile ? PERSPECTIVE_MOBILE : PERSPECTIVE,
        // A shallower band on a phone. The desktop shell deliberately hangs a
        // third of the work off the top and bottom of the frame, which is a
        // luxury a 700px-tall screen cannot afford — there it just reads as
        // most of the catalogue being missing.
        elevationSpread: isMobile ? 0.44 : DEFAULT_CLOUD.elevationSpread,
        // Smaller than desktop in absolute px, but far larger relative to the
        // viewport: a phone is where the frames were smallest of all.
        minScreen: isMobile ? 108 : DEFAULT_CLOUD.minScreen,
        maxScreen: isMobile ? 242 : DEFAULT_CLOUD.maxScreen,
      }),
    [performances, repeats, isMobile],
  )

  /**
   * Milliseconds elapsed in the opening pull.
   *
   * A ref, not a local in the loop, so that a re-run of the effect — StrictMode
   * does one on mount, and a resize across the mobile breakpoint does another —
   * resumes the pull where it was rather than yanking the room back out to
   * arm's length and starting it again.
   */
  const introClock = useRef(intro ? 0 : WELCOME_MS)
  /** The room's own opacity, which the loop writes while it comes up out of
   *  black. Kept so an unchanged value is not written again every frame. */
  const worldAlpha = useRef(-1)

  /** Where the viewer is looking. Eased toward the target every frame. */
  const yaw = useRef(0)
  const targetYaw = useRef(0)
  const pitch = useRef(0)
  const targetPitch = useRef(0)
  // 0.13 rather than 0.07: this is the filter the cursor's lean comes through,
  // and at 0.07 it settles in about a fifth of a second — long enough that the
  // room visibly finishes a movement the hand finished a while ago. Halving
  // the time constant is most of what "as fast as we move the cursor" is
  // asking for, and it is still a filter, so nothing arrives in one step.
  const pointer = usePointer(0.13)
  /** Distance dragged since pointerdown — a drag must not open a page. */
  const dragDistance = useRef(0)

  // The loop reads these through refs so it never has to be torn down and
  // rebuilt when the cloud is recomputed or the parent re-renders.
  const cloudRef = useRef(cloud)
  cloudRef.current = cloud
  const onFocusChangeRef = useRef(onFocusChange)
  onFocusChangeRef.current = onFocusChange

  const register = useCallback((key: string, refs: TileRefs | null) => {
    if (refs) registry.current.set(key, refs)
    else registry.current.delete(key)
  }, [])

  const handleSelect = useCallback(
    (tile: TileLayout, el: HTMLElement) => {
      if (dragDistance.current > 8) return
      zoomTo(
        el,
        tile.performance.poster,
        tile.performance.title,
        `/work/${tile.performance.slug}`,
      )
    },
    [zoomTo],
  )

  /* ---------------- input: wheel, drag, keyboard ---------------- */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Both wheel axes turn the head. Vertical scroll drives *yaw* rather than
    // pitch on purpose: pitch is clamped to a shallow band, so a wheel mapped
    // to it would hit the stop within one flick and feel broken, while yaw
    // goes round forever. This is now one way in among three — the cursor
    // steers and the hand drags — rather than the only one.
    const onWheel = (e: WheelEvent) => {
      targetYaw.current += (e.deltaY + e.deltaX) * YAW_PER_WHEEL
    }

    let dragging = false
    let lastX = 0
    let lastY = 0
    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      dragDistance.current = 0
    }
    // Deliberately not setPointerCapture: capturing retargets pointerup to the
    // container, which stops the tile button from ever receiving a click.
    // Listening on window covers dragging past the edge just as well.
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      // Both axes count toward the drag threshold, or a purely sideways drag
      // would still register as a click and open a page.
      dragDistance.current += Math.abs(dx) + Math.abs(dy)
      // Drag moves the world with the hand: pull right and the room comes
      // right, which means the heading goes the other way.
      targetYaw.current -= dx * YAW_PER_PX
      targetPitch.current = clamp(
        targetPitch.current + dy * PITCH_PER_PX,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      )
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = () => {
      dragging = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') targetYaw.current -= 0.28
      if (e.key === 'ArrowRight' || e.key === 'PageDown') targetYaw.current += 0.28
      // Up looks up. These were the wrong way round for the same reason the
      // cursor's pitch was — see the steering above.
      if (e.key === 'ArrowUp')
        targetPitch.current = clamp(
          targetPitch.current + 0.1,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        )
      if (e.key === 'ArrowDown')
        targetPitch.current = clamp(
          targetPitch.current - 0.1,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        )
    }

    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  /* ---------------- the single animation loop ---------------- */
  useEffect(() => {
    const world = worldRef.current
    if (!world) return

    /** The lens in play. Layout is built against the same one. */
    const P = isMobile ? PERSPECTIVE_MOBILE : PERSPECTIVE

    let raf = 0
    let last = 0
    let tick = 0
    /** Timestamp the ambient drift began, for the spin-up ramp. */
    let started = 0

    /** How still the pointer is, in px/s, smoothed. Decides hover — see
     *  FOCUS_TAKE_SPEED. */
    let speed = 0
    let lastPX = -1
    let lastPY = -1

    /** 0 while the room is free, 1 while a frame is being read. Eased, and it
     *  is what holds the room still under a resting cursor. */
    let focusFade = 0
    /** The lean the pointer had when focus was taken, held while it lasts. */
    let holdX = 0
    let holdY = 0
    let lastFocus: string | null = null

    // Cached rather than read per frame: `innerWidth` can force the engine to
    // settle pending style work before it answers, and this loop has just
    // written a transform to every frame on screen.
    let vw = window.innerWidth
    let vh = window.innerHeight
    const onResize = () => {
      vw = window.innerWidth
      vh = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const conceal = (entry: TileRefs) => {
      if (!entry.hidden) {
        entry.hidden = true
        entry.lastAlpha = 0
        entry.root.style.opacity = '0'
      }
      entry.depth = 0
      // Its lighting is stale the moment it stops being drawn, and a frame
      // that was lit when it left must not come back still lit.
      entry.lit = 0
    }

    const setFocus = (key: string | null) => {
      if (hoveredRef.current === key) return
      hoveredRef.current = key
      setHovered(key)
      const tile = key ? cloudRef.current.find((t) => t.key === key) : null
      // Where to put the caption, measured off the frame itself.
      //
      // The one place in this component that asks the DOM anything — and it
      // can, because it happens once when a frame takes focus rather than
      // eighty times a frame. It has to: the box the loop computes is the
      // frame's angular extent about its centre, which is the right thing for
      // hit-testing and a little short of the truth for a frame turned toward
      // the viewer, whose far edge stands taller than its near one. Placing a
      // caption against a box 70px shorter than the picture puts the caption
      // on the picture.
      let anchor: CaptionAnchor = { side: 'above', offset: vh * 0.5 }
      const el = key ? registry.current.get(key)?.root : undefined
      if (el) {
        const r = el.getBoundingClientRect()
        // Measured before it has grown into focus, so add the growth it is
        // about to make.
        const grow = ((HOVER_SCALE - 1) * r.height) / 2
        const top = r.top - grow
        const bottom = r.bottom + grow

        // Which side by whether the caption *fits* there, not by which half of
        // the screen the frame is in. A frame straddling the middle leaves
        // more room above than below — the links along the bottom take a
        // third of what looks like space — and choosing by position alone put
        // the caption where it had to be squeezed back onto its own picture.
        const roomAbove = top - CAPTION_GAP
        const roomBelow = vh - bottom - CAPTION_GAP
        const fitsAbove = roomAbove >= CAPTION_HEIGHT + CAPTION_TOP_SAFE
        const fitsBelow = roomBelow >= CAPTION_HEIGHT + CAPTION_BOTTOM_SAFE
        // Both or neither: take the roomier side. Otherwise, the one that fits.
        const below = fitsAbove === fitsBelow ? roomBelow > roomAbove : fitsBelow

        anchor = {
          side: below ? 'below' : 'above',
          // Clearing the picture is what this is for, so it is never traded
          // away — a caption crowding the edge of the screen still reads, and
          // one printed across the frame it describes does not.
          offset: Math.max(40, (below ? bottom : vh - top) + CAPTION_GAP),
        }
      }
      onFocusChangeRef.current?.(tile?.performance ?? null, anchor)
    }

    /**
     * Works out which frame the cursor is over, from the boxes the write phase
     * just computed.
     *
     * The room turns continuously, so a tile slides under a stationary cursor
     * and CSS alone never fires pointerenter — focus has to be resolved here.
     * It used to be resolved by asking every registered element for its
     * `getBoundingClientRect`, twenty times a second, each call having to
     * settle the style writes the loop had just made. The projection is exact
     * arithmetic, so the boxes are already known and this reads nothing: over
     * ten seconds of drifting, steering and hovering, style recalculations
     * fell from 636 to 484 and scripting from 335ms to 291ms.
     */
    const resolveFocus = () => {
      const { x, y } = pointer.client.current
      if (x < 0) return setFocus(null)

      const held = hoveredRef.current
      let best: string | null = null
      let bestDepth = -1

      registry.current.forEach((e) => {
        if (e.hidden || e.depth <= bestDepth) return
        const l = e.left!
        const r = e.right!
        const tp = e.top!
        const b = e.bottom!
        const inset = e.tile.key === held ? HOVER_KEEP : HOVER_GAIN
        const ix = (r - l) * inset
        const iy = (b - tp) * inset
        if (x < l + ix || x > r - ix) return
        if (y < tp + iy || y > b - iy) return
        best = e.tile.key
        bestDepth = e.depth
      })

      setFocus(best)
    }

    /**
     * Hands the decoder budget to the nearest frames on screen.
     *
     * Ranked by depth, so footage goes to the big ones at the front — where
     * motion actually reads — and the ones that lose it are far, small and
     * shaded, where a still is indistinguishable.
     *
     * One clip per performance: the shell hangs `repeats` copies of the
     * catalogue, so without this the same eight seconds can hold two decoders
     * at once for no visible gain.
     */
    const updatePlaying = () => {
      const maxPlaying = maxPlayingRef.current
      if (maxPlaying === 0) {
        if (playingRef.current.size) {
          playingRef.current = new Set()
          setPlaying(playingRef.current)
        }
        return
      }
      const prev = playingRef.current
      const near: { key: string; slug: string; rank: number }[] = []

      registry.current.forEach((e) => {
        // `hidden` already covers both behind-the-viewer and off-screen, so
        // there is nothing left to test against the viewport here.
        if (e.hidden) return
        if (e.right! - e.left! < PLAY_MIN_WIDTH) return
        near.push({
          key: e.tile.key,
          slug: e.tile.performance.slug,
          rank: e.depth + (prev.has(e.tile.key) ? PLAY_STICKY : 0),
        })
      })

      near.sort((a, b) => b.rank - a.rank)

      const next: string[] = []
      const claimed = new Set<string>()
      for (const n of near) {
        if (next.length >= maxPlaying) break
        if (claimed.has(n.slug)) continue
        claimed.add(n.slug)
        next.push(n.key)
      }

      if (next.length === prev.size && next.every((k) => prev.has(k))) return
      playingRef.current = new Set(next)
      setPlaying(playingRef.current)
    }

    /** Screen offset, in px, of a point at this bearing off the view axis. */
    const project = (angle: number) =>
      P * Math.tan(clamp(angle, -ANGLE_LIMIT, ANGLE_LIMIT))

    const frame = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16.667
      last = now
      const f = dt / 16.667
      const secs = dt / 1000

      const pt = pointer.step(f)
      const focus = hoveredRef.current

      /* ---- the opening pull ---- */
      // The clock stands still while the page is held — so nothing of the
      // opening plays out behind a page that is still loading — and stops for
      // good at the handover.
      if (!heldRef.current && introClock.current < WELCOME_MS) {
        introClock.current = Math.min(WELCOME_MS, introClock.current + dt)
      }
      const clock = introClock.current
      const introT = clamp((clock - INTRO_DELAY_MS) / INTRO_MS, 0, 1)
      const pull = introEase(introT)
      // How far behind its resting place the eye still is. The whole of the
      // room's approach is this one number going to zero.
      const seen = APPROACH_FROM + (1 - APPROACH_FROM) * pull
      const dolly = APPROACH_DEPTH * (1 / seen - 1)
      // Up out of black while it is already moving, rather than lit and then
      // set going.
      const rise = Math.round(smoothstep(0, INTRO_FADE, introT) * 100) / 100
      if (rise !== worldAlpha.current) {
        worldAlpha.current = rise
        world.style.opacity = String(rise)
      }
      // Input is answered from the last stretch of the pull, rather than from
      // the handover. An eased pull spends its tail covering almost no
      // distance, and a room that will not answer the mouse because a movement
      // nobody can see is still technically running looks broken.
      const live = introT >= 0.85
      if (clock !== lastWelcome.current) {
        lastWelcome.current = clock
        onIntroFrameRef.current?.(clock)
      }
      if (!arrivedRef.current && clock >= WELCOME_MS) {
        arrivedRef.current = true
        setArrived(true)
        onIntroDoneRef.current?.()
      }
      // Nothing is read until the sentence has gone: a caption coming up
      // under it would put two lots of words in the middle of the screen.
      const settled = arrivedRef.current

      /* ---- how still is the pointer? ---- */
      const cur = pointer.client.current
      if (cur.x < 0) {
        speed = 0
        lastPX = -1
      } else {
        const inst =
          lastPX < 0 ? 0 : Math.hypot(cur.x - lastPX, cur.y - lastPY) / secs
        // Roughly a 55ms time constant: quick enough that starting to move
        // drops focus at once, slow enough that the gaps between pointermove
        // events do not read as the hand having stopped.
        speed += (inst - speed) * (1 - Math.pow(1 - 0.25, f))
        lastPX = cur.x
        lastPY = cur.y
      }

      /* ---- reading a frame holds the room still ---- */
      //
      // Not by refusing to steer — by easing the room's authority to nothing
      // and back, so taking and losing focus are both movements rather than
      // cuts. This is the other half of what lets a frame be read anywhere on
      // the screen rather than only in a window in the middle: the cursor is
      // still deflected from centre while it rests on a picture, and without
      // this it would go on turning the room out from under the very frame it
      // is resting on.
      if (focus && focus !== lastFocus) {
        holdX = pt.x
        holdY = pt.y
        // Stop where we are, rather than gliding the last of the way to a
        // heading that was asked for before the cursor came to rest. The
        // caption is placed against the frame's box *at this instant*, so a
        // room that keeps easing for another quarter-second slides the frame
        // out from under its own caption — which is exactly what it looked
        // like: a title neatly clear of the picture, then sitting across it.
        targetYaw.current = yaw.current
        targetPitch.current = pitch.current
      }
      lastFocus = focus
      focusFade += ((focus ? 1 : 0) - focusFade) * (1 - Math.pow(1 - 0.14, f))
      const authority = 1 - focusFade

      /* ---- input: the cursor steers, and drift fills the gaps ---- */
      let steering = 0
      if (!isMobile && cur.x >= 0 && live) {
        const sx = steerAxis(pt.x)
        const sy = steerAxis(pt.y)
        steering = Math.max(Math.abs(sx), Math.abs(sy))
        targetYaw.current += sx * STEER_YAW * secs * authority
        // Minus, where the yaw above is plus, and that sign is the rest of
        // "difficult to move vertically": the two axes were steering by
        // opposite conventions. Pushing the cursor right turned the head
        // right, as it should — and pushing it *up* tipped the head *down*,
        // because pitch was wired the way a drag is wired, where the world
        // follows the hand. The two do not belong on one control. Aiming at
        // the ceiling now looks at the ceiling, and what was over the middle
        // of the screen slides down out of the way to reveal it, instead of
        // rising away and leaving the empty floor of the shell in frame.
        targetPitch.current = clamp(
          targetPitch.current - sy * STEER_PITCH * secs * authority,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        )
      }

      // The room turns gently on its own — but only while nobody is steering
      // it, not at all while a frame is being read, and never during the pull,
      // which is a move of its own and does not want a second one under it.
      if (!reduced && live) {
        if (!started) started = now
        const age = (now - started) / 1000
        const spin = age >= SPIN_UP ? 1 : 1 - Math.pow(1 - age / SPIN_UP, 3)
        targetYaw.current += DRIFT * spin * (1 - steering) * authority * f
      }

      // 0.11, up from 0.075 — a 145ms time constant against 215ms. The room
      // still arrives rather than snapping, but it stops finishing movements
      // the hand gave up on a quarter of a second ago.
      const ease = 1 - Math.pow(1 - 0.11, f)
      const beforeYaw = yaw.current
      const beforePitch = pitch.current
      yaw.current += (targetYaw.current - yaw.current) * ease
      pitch.current += (targetPitch.current - pitch.current) * ease
      /** How fast the room is actually turning, rad/s. Decides when it is
       *  worth moving the decoders around — see below. */
      const swing =
        (Math.abs(yaw.current - beforeYaw) + Math.abs(pitch.current - beforePitch)) /
        secs

      const t = now / 1000
      const cx = vw / 2
      const cy = vh / 2

      // The parallax lean, on top of the heading the steering has built up —
      // frozen at whatever it was when focus was taken, so that reading a
      // frame does not slide it out from under the cursor reading it.
      const lookX = pt.x + (holdX - pt.x) * focusFade
      const lookY = pt.y + (holdY - pt.y) * focusFade
      const lean = isMobile ? LOOK_TOUCH : 1
      const viewYaw = yaw.current + lookX * LOOK_YAW * lean
      const viewPitch = clamp(
        pitch.current - lookY * LOOK_PITCH * lean,
        -VIEW_PITCH_LIMIT,
        VIEW_PITCH_LIMIT,
      )

      /** Per-frame rate for each tile's own lighting ease — see `lit` below. */
      const litK = 1 - Math.pow(1 - 0.16, f)

      registry.current.forEach((entry) => {
        const { root, shade, tile } = entry

        // Bearing relative to where the viewer is facing, wrapped into
        // (−π, π] so the shell has no seam to cross.
        let a = (tile.azimuth - viewYaw) % TAU
        if (a > Math.PI) a -= TAU
        else if (a < -Math.PI) a += TAU

        const away = Math.abs(a)
        if (away > FOV_CULL) return conceal(entry)

        // Barely there. A 14px bob on every tile made the whole thing
        // shimmer; at this amplitude it reads as the room breathing.
        const float = reduced ? 0 : Math.sin(t * 0.32 + tile.phase) * 0.0016
        const e = tile.elevation - viewPitch + float

        const cosA = Math.cos(a)
        const cosE = Math.cos(e)
        const R = tile.radius

        // Straight spherical-to-camera. D is the distance in front of the
        // eye; on a shell the flanks swing close, so it falls off sharply
        // toward the edges of vision and those tiles read large.
        const D = R * cosA * cosE
        // Distance from the eye, which during the opening is still somewhere
        // behind the centre of the room — and further for some frames than
        // others, which is what turns the shell into a corridor while the eye
        // travels down it. See APPROACH_STAGGER.
        const stagger = 1 + APPROACH_STAGGER * (tile.phase / Math.PI - 1)
        const Z = D + dolly * stagger
        if (Z < NEAR_CLIP) return conceal(entry)

        const X = R * Math.sin(a) * cosE
        const Y = -R * Math.sin(e)

        // Where the frame lands on screen, in closed form.
        //
        // At rest the projection is rectilinear — a point at bearing θ lands
        // at P·tan(θ) from centre — and a tile of width w hung at radius R
        // subtends ±atan(w / 2R·cos e) about its own bearing, so its edges are
        // just two more tangents. Height is the same about its elevation, with
        // the 1/cos a that a horizontal angle adds to everything vertical.
        // Nothing here has to be measured.
        //
        // While the eye is still travelling in, bearings from the centre are
        // not bearings from the eye, and the box is the plain pinhole one
        // about the frame's centre instead. It only has to be good enough to
        // cull with: nothing is hovered, and nothing plays, until the room
        // has arrived.
        let left: number
        let right: number
        let top: number
        let bottom: number
        if (dolly > 0.5) {
          const s = P / Z
          const hw = tile.width / 2
          const hh = tile.width / tile.aspect / 2
          left = cx + (X - hw) * s
          right = cx + (X + hw) * s
          top = cy + (Y - hh) * s
          bottom = cy + (Y + hh) * s
        } else {
          const phi = Math.atan2(tile.width / 2, R * cosE)
          const psi = Math.atan2(tile.width / tile.aspect / 2, R)
          left = cx + project(a - phi)
          right = cx + project(a + phi)
          top = cy - project(e + psi) / cosA
          bottom = cy - project(e - psi) / cosA
        }

        // The real cull: a frame with no part of it near the viewport costs
        // nothing to skip, and skipping it is what keeps the number of tiles
        // being transformed each frame at what is actually on screen — about
        // twenty — rather than every one within the angular field.
        if (
          right < -OFFSCREEN_MARGIN ||
          left > vw + OFFSCREEN_MARGIN ||
          bottom < -OFFSCREEN_MARGIN ||
          top > vh + OFFSCREEN_MARGIN
        ) {
          return conceal(entry)
        }

        entry.left = left
        entry.right = right
        entry.top = top
        entry.bottom = bottom

        // Deliberately not toggling `visibility`: that invalidates layout on
        // every change, and the loop would then be forcing a reflow every time
        // a frame crossed the edge of the screen. Opacity alone stays on the
        // compositor.
        if (entry.hidden) entry.hidden = false

        // Nearness, 0..1, used to rank who gets a decoder and who paints on
        // top. Not a tunnel position any more — just "how big is this". The
        // far end of the scale reaches down the corridor while the opening is
        // still travelling, so the frames strung along it overlap in order.
        const reach =
          DEFAULT_CLOUD.maxRadius * 1.05 + dolly * (1 + APPROACH_STAGGER)
        const depth = clamp(1 - Z / reach, 0, 1)
        entry.depth = depth

        // translateZ(P − Z) puts the element exactly Z from the eye under a
        // perspective of P, so CSS scales it by P/Z — the pinhole projection,
        // done by the compositor.
        //
        // The two rotations turn each frame to face the viewer, and their
        // signs are the whole of "inward, not outward". A tile off to the
        // right has a > 0; rotateY(−a) swings its *right* edge toward the eye,
        // so the shell closes around the viewer like the inside of a drum.
        //
        // Z rather than D is the entire opening: the same room, drawn from a
        // point further back along the axis, which is a camera walking in.
        const transform =
          `perspective(${P}px) ` +
          `translate3d(${X.toFixed(1)}px, ${Y.toFixed(1)}px, ${(P - Z).toFixed(1)}px) ` +
          `rotateY(${(-a).toFixed(4)}rad) ` +
          `rotateX(${(-e).toFixed(4)}rad)`
        // Composing the string is cheap; handing it to the style system is
        // not, and while a frame is being read the room is still and every
        // one of these is identical to the last.
        if (transform !== entry.lastTransform) {
          entry.lastTransform = transform
          root.style.transform = transform
        }

        // Paint order is DOM order without a shared 3D context, so depth has
        // to drive z-index — and it is also what lifts the frame being read
        // clear of the wall, so its neighbours cannot overlap the one picture
        // the viewer is actually looking at.
        const z = focus === tile.key ? FOCUS_Z : Math.round(depth * 1000)
        if (z !== entry.lastZ) {
          entry.lastZ = z
          root.style.zIndex = String(z)
        }

        // Wash out toward the edge of vision so nothing pops in at the
        // shoulder. With the box cull above doing the real work this almost
        // never fires, which is the point: it is a backstop.
        const alpha =
          Math.round((1 - smoothstep(FOV_FADE, FOV_CULL, away)) * 200) / 200
        if (alpha !== entry.lastAlpha) {
          entry.lastAlpha = alpha
          root.style.opacity = String(alpha)
        }

        // Light. Held well down, and further for the far shell. Measured
        // against the reference recording, its room sits at about a quarter
        // of the brightness this one did — a dark room with pictures in it,
        // not a lit wall — which is also what lets the one frame being read
        // stand out as the only thing lit. Not darker than this: these are
        // stage photographs, and pushed further they go to mud.
        const shading = clamp(0.3 + (1 - depth) * 0.18, 0.3, 0.48)

        // "Is this the frame being read", eased per tile. It has to be per
        // tile and not a single flag, because the frame that *loses* focus
        // needs to give its shading back over the same quarter-second it took
        // it away — reading the shared `focus` alone snaps it back in one
        // frame, which is a flash at precisely the point the eye is resting.
        const want = focus === tile.key ? 1 : 0
        const lit = (entry.lit ?? 0) + (want - (entry.lit ?? 0)) * litK
        entry.lit = lit

        // Focus takes the light off everything else rather than blurring it.
        // 0.62 on top of the depth shading is the difference between "that one
        // is brighter" and "that one is the only thing lit", which is what the
        // reference does and what makes a caption readable over a wall of
        // moving pictures.
        const dim =
          Math.round(
            (1 - lit) *
              Math.min(DIM_MAX, shading + focusFade * DIM_OTHERS) *
              200,
          ) / 200
        if (dim !== entry.lastShade) {
          entry.lastShade = dim
          shade.style.opacity = String(dim)
        }
      })

      tick++
      // Which frame is being read, resolved from the boxes written just above
      // in this same frame, so hover never trails the picture it is over.
      //
      // The gate is the pointer's *speed*, not its position. A cursor crossing
      // the wall is steering and picks out nothing; a cursor that has come to
      // rest is reading whatever it came to rest on, wherever on the screen
      // that happens to be. Nothing is focusable while the opening pull is
      // still running, and nothing is hovered on a touch screen at all — a
      // finger has no resting state, so a lifted one would leave the last
      // frame it passed lit for good.
      const deflect = Math.max(Math.abs(pt.x), Math.abs(pt.y))
      const aim = pointer.target.current
      const swingLeft = Math.max(
        Math.abs(aim.x - pt.x) * LOOK_YAW,
        Math.abs(aim.y - pt.y) * LOOK_PITCH,
      )
      if (
        !settled ||
        suppressFocusRef.current ||
        isMobile ||
        speed > (focus ? FOCUS_KEEP_SPEED : FOCUS_TAKE_SPEED) ||
        deflect > (focus ? FOCUS_KEEP_DEFLECT : FOCUS_TAKE_DEFLECT) ||
        (!focus && swingLeft > FOCUS_SETTLE)
      ) {
        setFocus(null)
      } else {
        resolveFocus()
      }
      // Handing the decoders around costs more than everything else in this
      // loop put together — a torn-down video element and a started one, each
      // time the ranking changes — and the ranking changes constantly while
      // the room is turning, because that is what turning *is*. It also buys
      // nothing there: a frame crossing the screen reads as a picture whether
      // or not it happens to be moving. So the budget is re-cut five times a
      // second while the room is calm and rarely while it is not, which is
      // where a good share of the stutter during a sweep was coming from.
      const calm = swing < 0.25
      if (tick === 1 || tick % (calm ? 20 : 75) === 0) updatePlaying()

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
    // Deliberately short. `maxPlaying` is read through a ref rather than
    // listed here, and `pointer` is stable for the life of the component, so
    // this loop is built once and lives until the shell itself is rebuilt —
    // which is what lets it keep the pull's clock, the drift's ramp and the
    // focus fade between frames rather than starting them again on every
    // hover.
  }, [repeats, reduced, pointer, isMobile])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 touch-none select-none"
      aria-hidden="true"
    >
      {/* z-0 is load-bearing: it makes the wall its own stacking context, so
          the depth-derived z-index on each tile stays local and cannot paint
          over the scrims and vignette below. */}
      {/* Starts dark when the opening is to be played: the loop brings it up
          out of black on the intro's clock, and this is only where it starts,
          so the first paint is not a flash of the room before the pull. */}
      <div
        ref={worldRef}
        className="absolute inset-0 z-0"
        style={{ opacity: intro ? 0 : 1 }}
      >
        {cloud.map((tile) => (
          <GalleryTile
            key={tile.key}
            tile={tile}
            register={register}
            active={hovered === tile.key}
            playing={playing.has(tile.key)}
            onSelect={handleSelect}
          />
        ))}

      </div>

      {/* Darkness under the middle of the screen, for whatever copy is sitting
          there — and only while something is.

          It used to be on permanently at full strength, which cost the wall a
          third of its light in the one place the eye starts. It has three
          jobs now and a weight for each: most of it while the welcome sentence
          is over the opening, nearly off once the room has arrived and the
          sentence has gone, and a little of it back while a caption is up.
          Never enough to touch the frame being read — the tiles dim
          themselves for that, from the inside, so the lit one stays lit. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse 44% 36% at 50% 50%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.34) 48%, transparent 76%)',
          opacity: !arrived ? 0.6 : hovered ? 0.34 : 0.12,
          transition: 'opacity 900ms var(--ease-out-expo)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_46%,rgba(0,0,0,0.66)_100%)]" />

      {/* Edge scrims: the wall runs behind the wordmark and the bottom links,
          and a bright tile drifting past must never eat them.

          The bottom one was the heavier of the two — 224px of near-solid black
          — and it is a third of the frame. Measured band luminance across the
          page ran 18 / 59 / 27 / 17 / 4 / 5 from top to bottom: the room had no
          floor, and most of that was this. Lightened to the weight the top one
          carries, which the links' own text-shadow is more than able to sit
          on. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-void via-void/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-t from-void/95 via-void/55 to-transparent" />
    </div>
  )
}
