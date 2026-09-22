import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Performance } from '@/types/content'
import {
  ImmersiveGallery,
  type CaptionAnchor,
} from '@/components/gallery/ImmersiveGallery'
import { MagneticLink } from '@/components/ui/MagneticLink'
import { SplitText } from '@/components/ui/SplitText'
import { HouseMusic, type HouseMusicHandle } from '@/components/audio/HouseMusic'
import { SoundGate } from '@/components/audio/SoundGate'
import {
  useCategoryMap,
  useMusicCopy,
  usePerformances,
  useProfile,
  useUi,
} from '@/content/ContentProvider'
import { fill } from '@/lib/copy'

/**
 * That the sound question has been put to this visitor.
 *
 * The answer itself is not kept here — it goes to the player, which already
 * owns and remembers one, so declining the gate and silencing the control are
 * the same fact rather than two that can disagree.
 */
const GATE_KEY = 'house-gate-asked'

/** Large tracked word — the nouns that carry the sentence. */
const Big = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked on-scrim text-[clamp(1.05rem,2.6vw,2.15rem)] text-chalk">
    {children}
  </span>
)

/** Small connective word, sitting between the nouns. */
const Small = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked on-scrim text-[clamp(0.5rem,0.9vw,0.72rem)] text-mist">
    {children}
  </span>
)

export default function Home() {
  const { items } = usePerformances()
  const profile = useProfile()
  const ui = useUi()
  const categoryMap = useCategoryMap()
  const { houseClip } = useMusicCopy()
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

  // The index is a fixed, non-scrolling surface — travel is the scroll here.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /** The take the page sounds on arrival. See `music.houseClip`. */
  const house = items.find((p) => p.slug === houseClip.slug)
  const houseTrack = house?.tracks[0]
  const houseHandle = useRef<HouseMusicHandle>(null)

  /**
   * Whether the sound question still has to be asked.
   *
   * Asked once a visit, not once a page view: the index is where the site
   * begins, and a visitor who has been to the work and come back has already
   * answered. Read straight out of storage on the first render rather than in
   * an effect, so the gate is either painted with the page or never painted at
   * all — a panel that appears a frame after the index has is a flicker.
   */
  const [asking, setAsking] = useState(() => {
    try {
      return sessionStorage.getItem(GATE_KEY) !== '1'
    } catch {
      return true
    }
  })

  const answer = useCallback((withSound: boolean) => {
    try {
      sessionStorage.setItem(GATE_KEY, '1')
    } catch {
      /* blocked storage: the question simply gets asked again next time */
    }
    // Before the state change, not after: this is still inside the click, and
    // the click is the permission.
    const player = houseHandle.current
    if (withSound) player?.start()
    else player?.silence()
    setAsking(false)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden bg-void">
      <ImmersiveGallery
        performances={items}
        onFocusChange={onFocusChange}
        onIntroDone={onIntroDone}
        held={asking}
      />

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
              className="absolute max-w-4xl px-6 text-center"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14, filter: 'blur(8px)' }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* One <p> a line, one word a token. The shape is in the copy
                  rather than in this markup, so a line can be rewritten,
                  lengthened or dropped from the panel without a deploy — and
                  `{name}` is a slot, so the sentence cannot disagree with the
                  wordmark above it. */}
              <div className="flex flex-col gap-3">
                {ui.home.welcome.map((line, li) => (
                  <p
                    key={li}
                    className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1"
                  >
                    {line.map((token, ti) => {
                      const text = fill(token.text, { name: profile.name })
                      return token.kind === 'big' ? (
                        <Big key={ti}>{text}</Big>
                      ) : (
                        <Small key={ti}>{text}</Small>
                      )
                    })}
                  </p>
                ))}
              </div>
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
            {line.map((token, ti) =>
              token.kind === 'link' ? (
                <MagneticLink
                  key={ti}
                  to={token.to ?? '/'}
                  className="pointer-events-auto"
                >
                  <span className="tracked on-scrim text-[clamp(0.85rem,1.7vw,1.35rem)] text-chalk transition-colors duration-300 hover:text-bloom">
                    {token.text}
                  </span>
                </MagneticLink>
              ) : (
                <Small key={ti}>{token.text}</Small>
              ),
            )}
          </p>
        ))}
      </div>

      {/* ---------------- the room's own sound ---------------- */}
      {house && houseTrack?.audioSrc && (
        <HouseMusic
          handle={houseHandle}
          gated={asking}
          src={houseTrack.audioSrc}
          title={house.title}
          from={houseClip.from}
          to={houseClip.to ?? undefined}
        />
      )}

      {/* The question, over everything, until it has been answered once. */}
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
        <span className="label text-dust">{ui.home.driftHint}</span>
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
