import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Performance } from '@/types/content'
import {
  ImmersiveGallery,
  type CaptionAnchor,
} from '@/components/gallery/ImmersiveGallery'
import { CursorLabel } from '@/components/gallery/CursorLabel'
import { MagneticLink } from '@/components/ui/MagneticLink'
import { SplitText } from '@/components/ui/SplitText'
import { useHouseMusic } from '@/components/audio/HouseMusic'
import { SoundGate } from '@/components/audio/SoundGate'
import {
  useCategoryMap,
  usePerformances,
  useProfile,
  useUi,
} from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { fill } from '@/lib/copy'
import { smoothstep } from '@/lib/utils'
import { EditableText } from '@/components/edit/Editable'
import { ItemControls, RegionEdit } from '@/components/edit/ListEdit'

/**
 * The welcome sentence's trip into the room.
 *
 * It starts in front of the screen, drawn larger than it is set, and travels
 * back into the wall, the way the reference's own sentence does.
 *
 * Size is interpolated on a log scale rather than a straight line, because
 * that is how distance reads: halving in size looks like the same step back
 * whether it is from 1.3 to 0.65 or from 0.8 to 0.4. A straight line — or a
 * true 1/z from a point just in front of the lens — spends most of its change
 * in the first few hundred milliseconds, which is exactly when the sentence
 * wants to hold still long enough to be read.
 */
/** Scale it starts at: a little in front of the screen. */
const WELCOME_NEAR = 1.3
/** The same on a phone, where the sentence already spans the screen at its
 *  set size and could not start much larger without losing its ends. */
const WELCOME_NEAR_MOBILE = 1.08
/** Scale it has got to by the handover, when it is gone. */
const WELCOME_FAR = 0.4
/** How dark the wall is held while the sentence is read. It lifts as the
 *  sentence recedes, and is gone by the time the sentence is. */
const WELCOME_DIM = 0.8

/** How far back the sentence has gone, 0 → 1, for a given share of the
 *  welcome. Steeply eased in: it barely moves at first, so it can be read
 *  where it starts, and only picks up pace once it is on its way out. */
const welcomeDepth = (progress: number) => Math.pow(progress, 2.5)

/** The sentence's scale at a given share of the welcome. */
function welcomeScale(progress: number, mobile: boolean) {
  const near = mobile ? WELCOME_NEAR_MOBILE : WELCOME_NEAR
  return near * Math.pow(WELCOME_FAR / near, welcomeDepth(progress))
}

/** Small connective word, sitting between the links at the foot. */
const Small = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked on-scrim text-[clamp(0.5rem,0.9vw,0.72rem)] text-mist">
    {children}
  </span>
)

/**
 * The welcome sentence's two sizes, in the reference's face — see
 * `--font-welcome`. A touch smaller than the words at the foot of the page,
 * because the sentence starts in front of the screen and is drawn larger than
 * this to begin with.
 */
const WelcomeBig = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked-welcome on-scrim text-[clamp(0.98rem,2.2vw,1.85rem)] text-chalk">
    {children}
  </span>
)

const WelcomeSmall = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked-welcome on-scrim text-[clamp(0.48rem,0.82vw,0.68rem)] text-mist">
    {children}
  </span>
)

export default function Home() {
  const { items } = usePerformances()
  const profile = useProfile()
  const ui = useUi()
  const { editing } = useEdit()
  const categoryMap = useCategoryMap()
  const isMobile = useIsMobile()
  const [focused, setFocused] = useState<Performance | null>(null)
  /** Where the caption sits, so it never lands on the frame it describes. */
  const [anchor, setAnchor] = useState<CaptionAnchor>({
    side: 'below',
    offset: 470,
  })
  const onFocusChange = useCallback(
    (performance: Performance | null, next: CaptionAnchor) => {
      setFocused(performance)
      // Only while there is something to place: taking the anchor from a
      // clearing focus would swing the caption across the screen on its way
      // out.
      if (performance) setAnchor(next)
    },
    [],
  )
  /**
   * Set once, part-way through the gallery's opening pull.
   *
   * The welcome sentence belongs to that wide establishing shot and to nothing
   * after it: once the room has arrived, the work is the page, and a paragraph
   * parked across the middle of it is just something to look past. So it is
   * shown while the room is still far away and retired as it lands — the one
   * thing it is for, done once.
   */
  const [arrived, setArrived] = useState(false)
  const onIntroDone = useCallback(() => setArrived(true), [])

  /**
   * The sentence travelling back into the room, and the wall behind it
   * coming up out of the dark as it goes.
   *
   * Driven off the gallery's own intro clock, once a frame, by writing the
   * two styles directly — a re-render sixty times a second to move one line
   * of type would be a strange thing to add to a page already turning eighty
   * pictures.
   *
   * The travel is eased *in*: it barely moves at first, so the sentence can
   * be read where it starts, and it picks up pace only as it goes. The wall's
   * dimming follows the same curve, so the room is held dark behind the words
   * while they are being read and brightens as they leave.
   */
  const welcomeRef = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef(isMobile)
  mobileRef.current = isMobile
  const onIntroFrame = useCallback((progress: number) => {
    const depth = welcomeDepth(progress)
    const el = welcomeRef.current
    if (el) {
      const scale = welcomeScale(progress, mobileRef.current)
      // In quickly, so the first thing seen is the whole sentence; out over
      // the back half of its trip, so it thins into the room rather than
      // being switched off.
      const appear = smoothstep(0, 0.14, progress)
      const vanish = 1 - smoothstep(0.45, 1, depth)
      el.style.transform = `scale(${scale.toFixed(4)})`
      el.style.opacity = (appear * vanish).toFixed(3)
    }
    const dim = dimRef.current
    if (dim) dim.style.opacity = (WELCOME_DIM * (1 - depth)).toFixed(3)
  }, [])

  // The index is a fixed, non-scrolling surface — travel is the scroll here.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /**
   * Whether the sound question still has to be asked.
   *
   * Asked once a visit, not once a page view, and owned by the site's music
   * rather than by this page — the recording plays under every page now, so
   * whether the visitor has answered is a fact about the visit. See
   * HouseMusicProvider.
   */
  const { asking, answer } = useHouseMusic()

  return (
    <div className="fixed inset-0 overflow-hidden bg-void">
      <ImmersiveGallery
        performances={items}
        onFocusChange={onFocusChange}
        onIntroDone={onIntroDone}
        onIntroFrame={onIntroFrame}
        held={asking}
      />

      {/* The wall held in the dark while the welcome is read, lifting as the
          sentence goes back into it. Its opacity is written by
          `onIntroFrame`; this is only where it starts. */}
      {!arrived && (
        <div
          ref={dimRef}
          className="pointer-events-none absolute inset-0 bg-void"
          style={{ opacity: WELCOME_DIM }}
        />
      )}

      {/* ---------------- centre overlay ----------------

          Two things live here and they never overlap in time: the welcome
          sentence, which belongs to the opening shot, and the caption for
          whichever frame is being read, which belongs to everything after it.

          Both are absolutely placed rather than sharing a flex slot, and the
          `AnimatePresence` has no `mode` on purpose. `mode="wait"` held the
          incoming caption until the outgoing one had finished leaving, so
          moving from one frame to the next left the middle of the screen empty
          for half a second — read as the page hanging. Overlapping them
          crossfades instead, which is what the eye expects when the thing
          being described has changed rather than gone. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <AnimatePresence>
          {!arrived ? (
            <motion.div
              key="welcome"
              // The layer over the gallery is `pointer-events-none` so the room
              // can be dragged through it. A field that cannot be clicked is not
              // a field, so editing takes the events back — and takes the drag
              // with them, which is the right trade while words are being typed.
              className={`absolute max-w-5xl px-6 text-center ${
                editing ? 'pointer-events-auto' : ''
              }`}
              // Its whole trip is written by `onIntroFrame` onto the div
              // inside. By the time this leaves, the sentence is already out of
              // sight at the back of the room, so the exit only has to make sure
              // nothing is left behind.
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
            >
              {/* One <p> a line, one word a token. The shape is in the copy
                  rather than in this markup, so a line can be rewritten,
                  lengthened or dropped from the panel without a deploy — and
                  `{name}` is a slot, so the sentence cannot disagree with the
                  wordmark above it. */}
              <div
                ref={welcomeRef}
                className="flex flex-col gap-3 will-change-transform"
                style={{
                  opacity: 0,
                  transform: `scale(${welcomeScale(0, isMobile).toFixed(4)})`,
                }}
              >
                {ui.home.welcome.map((line, li) => (
                  <p
                    key={li}
                    className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1"
                  >
                    {line.map((token, ti) => {
                      // Edit mode shows the template, not the filled string:
                      // `{name}` is a slot the sentence has to keep, and a word
                      // that had been substituted away could not be typed back.
                      const shown = editing
                        ? token.text
                        : fill(token.text, { name: profile.name })
                      const field = (
                        <EditableText
                          path={['ui', 'home', 'welcome', li, ti, 'text']}
                          value={shown}
                          placeholder="Word"
                        />
                      )
                      return (
                        <span key={ti} className="inline-flex items-baseline gap-1">
                          {token.kind === 'big' ? (
                            <WelcomeBig>{field}</WelcomeBig>
                          ) : (
                            <WelcomeSmall>{field}</WelcomeSmall>
                          )}
                          <ItemControls
                            path={['ui', 'home', 'welcome', li]}
                            index={ti}
                            blank={() => ({ kind: token.kind, text: 'word' })}
                          />
                        </span>
                      )
                    })}
                  </p>
                ))}
              </div>

              {editing && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <RegionEdit drawer="copy" label="Index copy & the sound question" />
                  <RegionEdit drawer="categories" label="What plays under the index" />
                </div>
              )}
            </motion.div>
          ) : focused ? (
            <motion.div
              key={focused.slug}
              className="absolute inset-x-0 mx-auto max-w-3xl px-6 text-center"
              style={
                anchor.side === 'below'
                  ? { top: anchor.offset }
                  : { bottom: anchor.offset }
              }
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Cream, not the category's colour. Hovering along the wall
                  used to cycle the label through amber, pink and violet,
                  which is exactly the "strange colours" in the reference's
                  absence — everything there is one warm off-white. */}
              <p className="label on-scrim mb-5 text-mist">
                {categoryMap[focused.category]?.label} — {focused.year}
              </p>
              <h2 className="tracked on-scrim text-[clamp(1.4rem,4vw,3.1rem)] leading-[1.25] text-chalk">
                <SplitText text={focused.title} stagger={0.035} />
              </h2>
              <p className="on-scrim mx-auto mt-6 max-w-xl text-[0.78rem] leading-relaxed font-light tracking-wider text-mist uppercase">
                {focused.blurb}
              </p>
              {/* No "learn more" here any more — it sits on the frame itself
                  now, where there is no doubt which picture it opens. */}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ---------------- bottom nav, reference-style ---------------- */}
      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3 px-6 md:bottom-14">
        {ui.home.nav.map((line, li) => (
          <p
            key={li}
            className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1"
          >
            {line.map((token, ti) => (
              <span key={ti} className="inline-flex items-baseline gap-1">
                {token.kind === 'link' ? (
                  <MagneticLink to={token.to ?? '/'} className="pointer-events-auto">
                    <span className="tracked on-scrim text-[clamp(0.85rem,1.7vw,1.35rem)] text-chalk transition-colors duration-300 hover:text-bloom">
                      <EditableText
                        path={['ui', 'home', 'nav', li, ti, 'text']}
                        value={token.text}
                        placeholder="Word"
                      />
                    </span>
                  </MagneticLink>
                ) : (
                  <Small>
                    <EditableText
                      path={['ui', 'home', 'nav', li, ti, 'text']}
                      value={token.text}
                      placeholder="Word"
                    />
                  </Small>
                )}
                <ItemControls
                  path={['ui', 'home', 'nav', li]}
                  index={ti}
                  className="pointer-events-auto"
                  blank={() => ({ kind: 'small', text: 'and' })}
                />
              </span>
            ))}
          </p>
        ))}
      </div>

      {/* ---------------- the invitation, on the cursor ----------------

          Only while a frame is being read, and never on a touch screen, where
          nothing is ever hovered and there is no cursor to carry it. */}
      {!isMobile && (
        <CursorLabel text={ui.gallery.learnMore} visible={Boolean(focused)} />
      )}

      {/* The question, over everything, until it has been answered once. The
          music it asks about is the site's, not this page's — it lives in
          HouseMusicProvider, with the speaker that turns it on and off. */}
      <AnimatePresence>
        {asking && <SoundGate key="gate" onChoose={answer} />}
      </AnimatePresence>

      {/* ---------------- drift hint ---------------- */}
      <motion.div
        className="pointer-events-none absolute right-6 bottom-10 hidden items-center gap-3 md:flex md:right-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: !arrived || focused ? 0 : 1 }}
        transition={{ duration: 0.6, delay: focused ? 0 : 0.5 }}
      >
        {/* The cursor is the primary control now — the room turns while the
            pointer is held away from the middle, and holds still when it comes
            back. Dragging and scrolling still work, but they are no longer the
            thing to tell someone about first. */}
        <span className={`label text-dust ${editing ? 'pointer-events-auto' : ''}`}>
          <EditableText
            path={['ui', 'home', 'driftHint']}
            value={ui.home.driftHint}
          />
        </span>
        <span className="breathe block h-6 w-px bg-gradient-to-b from-transparent via-bloom to-transparent" />
      </motion.div>

      {/* Tiles are decorative for assistive tech (they duplicate down the
          tunnel); this is the real, linear index of the same work. */}
      <nav className="sr-only">
        <h2>{ui.home.srHeading}</h2>
        <ul>
          {items.map((p) => (
            <li key={p.slug}>
              <Link to={`/work/${p.slug}`}>
                {p.title} — {p.subtitle}, {p.year}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
