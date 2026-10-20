import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Performance } from '@/types/content'
import {
  ImmersiveGallery,
  PULL_END_MS,
  WELCOME_MS,
  type CaptionAnchor,
} from '@/components/gallery/ImmersiveGallery'
import { CursorLabel } from '@/components/gallery/CursorLabel'
import { MagneticLink } from '@/components/ui/MagneticLink'
import { SplitText } from '@/components/ui/SplitText'
import { Flicker } from '@/components/ui/Flicker'
import {
  useCategoryMap,
  usePerformances,
  useProfile,
  useUi,
} from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { useIsMobile, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { usePageReady } from '@/hooks/usePageReady'
import { fill } from '@/lib/copy'
import { clamp, smoothstep } from '@/lib/utils'
import { EditableText } from '@/components/edit/Editable'
import { ItemControls, RegionEdit } from '@/components/edit/ListEdit'

/**
 * The opening plays once a visit.
 *
 * It is an arrival — the room seen from far off, closing in, the sentence
 * saying whose it is — and arriving a second time, every time somebody comes
 * back from a project page, turns it into a wait in front of the thing they
 * came back for. Kept for the life of the tab: in memory, so it holds even
 * where storage is refused, and in sessionStorage, so a reload in the same
 * tab does not count as a first visit either.
 */
const INTRO_SEEN_KEY = 'sanjana.intro-seen'
let introSeen = false

function hasSeenIntro() {
  if (introSeen) return true
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markIntroSeen() {
  introSeen = true
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    // Private mode or storage refused: the in-memory flag still holds for
    // the rest of this page load.
  }
}

/**
 * The welcome sentence's approach.
 *
 * Measured off the reference recording: the sentence arrives at a little under
 * half the size it is set at and grows toward the viewer with the room — fast
 * at first, settling — reaching its set size as the pull lands. Fitted against
 * the width of its longest line across eight frames, a quadratic ease-out from
 * 0.46 matches every one of them to within a few pixels.
 */
const WELCOME_FROM = 0.46
/** How long the sentence takes to go, at the end of its time on screen. */
const WELCOME_OUT_MS = 320

function welcomeScale(elapsed: number) {
  const u = clamp(elapsed / PULL_END_MS, 0, 1)
  return WELCOME_FROM + (1 - WELCOME_FROM) * (1 - (1 - u) * (1 - u))
}

/** Seconds over which the welcome sentence's letters catch. */
const WELCOME_FLICKER = 1.1
/** Seconds over which the name's letters catch, once the room has arrived. */
const NAME_FLICKER = 0.6

/** Small connective word, sitting between the links at the foot. */
const Small = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked on-scrim text-[clamp(0.5rem,0.9vw,0.72rem)] text-mist">
    {children}
  </span>
)

/**
 * The welcome sentence's two sizes, in the reference's face — see
 * `--font-sans`. The big words are set at the size of the links at the foot
 * of the page, which is where the reference's own sentence lands.
 */
const WelcomeBig = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked-welcome on-scrim text-[clamp(0.85rem,1.7vw,1.35rem)] text-chalk">
    {children}
  </span>
)

const WelcomeSmall = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked-welcome on-scrim text-[clamp(0.45rem,0.7vw,0.58rem)] text-mist">
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
  const reduced = usePrefersReducedMotion()
  /** The opening waits for the page: see usePageReady. */
  const ready = usePageReady()

  /**
   * Whether this visit skips the opening, decided once on arrival.
   *
   * Editing always gets it: the welcome sentence is only on screen during the
   * opening, and a sentence that never appears cannot be edited in place.
   */
  const [skipIntro] = useState(() => reduced || (!editing && hasSeenIntro()))
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
   * Set at the handover, when the room has landed and been held a moment.
   *
   * The welcome sentence belongs to the opening and to nothing after it. Once
   * the room has arrived it goes, and the page's own lettering comes in: the
   * name at the top, the way into the index in the middle, the links at the
   * foot — the reference's order, and its layout.
   */
  const [arrived, setArrived] = useState(skipIntro)
  const onIntroDone = useCallback(() => {
    markIntroSeen()
    setArrived(true)
  }, [])

  /**
   * The sentence coming toward the viewer with the room.
   *
   * Driven off the gallery's own intro clock, once a frame, by writing the
   * style directly — a re-render sixty times a second to move one line of
   * type would be a strange thing to add to a page already turning eighty
   * pictures. Its letters arriving is Flicker's job; this is only its size,
   * and its going.
   */
  const welcomeRef = useRef<HTMLDivElement>(null)
  const onIntroFrame = useCallback((elapsed: number) => {
    const el = welcomeRef.current
    if (!el) return
    el.style.transform = `scale(${welcomeScale(elapsed).toFixed(4)})`
    el.style.opacity = (
      1 - smoothstep(WELCOME_MS - WELCOME_OUT_MS, WELCOME_MS, elapsed)
    ).toFixed(3)
  }, [])

  /**
   * The link in the middle is in the middle of the room too, and the room
   * lights whatever frame a resting cursor is over — which would swap the link
   * for a caption the moment the pointer settled on it to click. Over the
   * link, the room is told to leave it be.
   */
  const [overIndexLink, setOverIndexLink] = useState(false)

  // The index is a fixed, non-scrolling surface — travel is the scroll here.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /** Lettering on the overlay is not hit-testable unless it is a field being
   *  edited or a link: everything else lets the room be dragged through it. */
  const live = arrived ? 'pointer-events-auto' : 'pointer-events-none'

  return (
    <div className="fixed inset-0 overflow-hidden bg-void">
      <ImmersiveGallery
        performances={items}
        onFocusChange={onFocusChange}
        onIntroDone={onIntroDone}
        onIntroFrame={onIntroFrame}
        held={!ready}
        skipIntro={skipIntro}
        suppressFocus={overIndexLink}
      />

      {/* ---------------- the name, along the top ----------------

          Not the site's bar. The reference's index has none — its name and
          what it does sit centred over the room, and the way to everything
          else is the sentence at the foot — so the bar is left off this page
          (see App.tsx) and this takes its place. The name flickers in as the
          room lands; the role comes up under it after. */}
      {arrived && (
        <header
          className={`absolute inset-x-0 top-[6.5vh] px-6 text-center ${
            editing ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <h1 className="tracked on-scrim text-[clamp(0.85rem,1.7vw,1.35rem)] text-chalk">
            {editing ? (
              <EditableText path={['profile', 'name']} value={profile.name} />
            ) : skipIntro ? (
              profile.name
            ) : (
              <Flicker text={profile.name} spread={NAME_FLICKER} />
            )}
          </h1>
          <motion.p
            className="tracked on-scrim mt-2 text-[clamp(0.5rem,0.85vw,0.7rem)] text-mist"
            initial={skipIntro ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
          >
            <EditableText path={['profile', 'role']} value={profile.role} />
          </motion.p>
        </header>
      )}

      {/* ---------------- centre overlay ----------------

          Three things live here and never at the same time: the welcome
          sentence, which belongs to the opening; the way into the index,
          which is what the middle of the room says once it has arrived; and
          the caption for whichever frame is being read, which takes the
          middle over while it is.

          All absolutely placed rather than sharing a flex slot, and the
          `AnimatePresence` has no `mode` on purpose. `mode="wait"` held the
          incoming caption until the outgoing one had finished leaving, so
          moving from one frame to the next left the middle of the screen empty
          for half a second — read as the page hanging. Overlapping them
          crossfades instead, which is what the eye expects when the thing
          being described has changed rather than gone. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <AnimatePresence>
          {!arrived ? (
            ready && (
              <motion.div
                key="welcome"
                // The layer over the gallery is `pointer-events-none` so the
                // room can be dragged through it. A field that cannot be
                // clicked is not a field, so editing takes the events back.
                className={`absolute max-w-5xl px-6 text-center ${
                  editing ? 'pointer-events-auto' : ''
                }`}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                {/* One <p> a line, one word a token. The shape is in the copy
                    rather than in this markup, so a line can be rewritten,
                    lengthened or dropped from the panel without a deploy — and
                    `{name}` is a slot, so the sentence cannot disagree with
                    the name above it. */}
                <div
                  ref={welcomeRef}
                  className="flex flex-col gap-3 will-change-transform"
                  style={{ transform: `scale(${WELCOME_FROM})` }}
                >
                  {ui.home.welcome.map((line, li) => (
                    <p
                      key={li}
                      className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1"
                    >
                      {line.map((token, ti) => {
                        // Edit mode shows the template, not the filled string:
                        // `{name}` is a slot the sentence has to keep, and a
                        // word that had been substituted away could not be
                        // typed back.
                        const shown = editing
                          ? token.text
                          : fill(token.text, { name: profile.name })
                        const word = editing ? (
                          <EditableText
                            path={['ui', 'home', 'welcome', li, ti, 'text']}
                            value={shown}
                            placeholder="Word"
                          />
                        ) : (
                          <Flicker text={shown} spread={WELCOME_FLICKER} />
                        )
                        return (
                          <span key={ti} className="inline-flex items-baseline gap-1">
                            {token.kind === 'big' ? (
                              <WelcomeBig>{word}</WelcomeBig>
                            ) : (
                              <WelcomeSmall>{word}</WelcomeSmall>
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
                    <RegionEdit drawer="copy" label="Index copy" />
                    <RegionEdit drawer="categories" label="What plays under the index" />
                  </div>
                )}
              </motion.div>
            )
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
              <p className="label on-scrim mb-3 text-mist">
                {categoryMap[focused.category]?.label} — {focused.year}
              </p>
              {/* Set the way the reference sets its own: the title at about the
                  size of the name over the room rather than as a headline,
                  and the sentence under it in small, widely spaced capitals.
                  A caption is a label for the picture, and at headline size it
                  was bigger than the picture it was labelling. */}
              <h2 className="tracked on-scrim text-[clamp(1rem,2.1vw,1.75rem)] leading-[1.3] text-chalk">
                <SplitText text={focused.title} stagger={0.035} />
              </h2>
              <p className="on-scrim mx-auto mt-4 max-w-2xl text-[0.62rem] leading-[1.9] tracking-[0.28em] text-mist uppercase">
                {focused.blurb}
              </p>
              {/* No "learn more" here any more — it sits on the frame itself
                  now, where there is no doubt which picture it opens. */}
            </motion.div>
          ) : (
            <motion.div
              key="index-view"
              // Just under the middle, where the reference hangs it, with a
              // hairline over it — a plumb line down into the room.
              className="absolute top-1/2 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.6, delay: skipIntro ? 0 : 0.25 }}
            >
              <Link
                to="/work?view=list"
                onPointerEnter={() => setOverIndexLink(true)}
                onPointerLeave={() => setOverIndexLink(false)}
                className="group pointer-events-auto flex flex-col items-center gap-2 px-4 py-2"
              >
                <span className="block h-4 w-px bg-chalk/55 transition-colors duration-300 group-hover:bg-bloom" />
                <span className="tracked on-scrim text-[clamp(0.55rem,0.8vw,0.68rem)] whitespace-nowrap text-chalk/85 transition-colors duration-300 group-hover:text-bloom">
                  <EditableText path={['ui', 'home', 'indexView']} value={ui.home.indexView} />
                </span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------------- bottom nav, reference-style ----------------

          Not there during the opening: it arrives with the name, rising a
          little as it comes up, once the room has landed. */}
      <motion.div
        className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3 px-6 md:bottom-14"
        initial={false}
        animate={{ opacity: arrived ? 1 : 0, y: arrived ? 0 : 12 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {ui.home.nav.map((line, li) => (
          <p
            key={li}
            className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1"
          >
            {line.map((token, ti) => (
              <span key={ti} className="inline-flex items-baseline gap-1">
                {token.kind === 'link' ? (
                  <MagneticLink to={token.to ?? '/'} className={live}>
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
                  className={live}
                  blank={() => ({ kind: 'small', text: 'and' })}
                />
              </span>
            ))}
          </p>
        ))}
      </motion.div>

      {/* ---------------- the invitation, on the cursor ----------------

          Only while a frame is being read, and never on a touch screen, where
          nothing is ever hovered and there is no cursor to carry it. */}
      {!isMobile && (
        <CursorLabel text={ui.gallery.learnMore} visible={Boolean(focused)} />
      )}

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
