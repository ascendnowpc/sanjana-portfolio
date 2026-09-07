import { useEffect, useRef, type ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { mediaUrl } from "@/lib/media";

/**
 * The black inside the film's frame, a shade under the site's own.
 *
 * A shade off true black rather than #000, so the frame is a surface with the
 * film sitting on it rather than a hole cut in the page, and so the film's own
 * black has something a step darker to sit against.
 *
 * It used to be painted on the whole section too, for the same reason — at
 * #000 the opening read as a hole rather than a ground. The page it opens
 * carries a field of points now, and points are a better answer to that
 * problem than two points of grey were: the section shows the page's own
 * ground and its stars, and only the frame keeps the lift.
 *
 * Scoped here rather than promoted to a token: the page returns to
 * --color-void at the edge of the frame, and the step between them is small
 * enough to read as depth rather than as a seam.
 */
const OPENING_BLACK = "#070707";

interface Props {
  /** Looping film, stored as a media key ("/media/video/x.mp4"). */
  src: string;
  /**
   * A narrower cut of the same film for phones and tablets, stored the same
   * way. Handed to the browser as a `media`-qualified <source> ahead of `src`,
   * so a small screen never pays for a frame it cannot resolve. Optional —
   * without it every viewport gets `src`.
   */
  srcSmall?: string;
  /** First frame, so the panel is never an empty black box. */
  poster?: string;
  /** The poster-weight headline that lifts away as the film takes over. */
  children: ReactNode;
  /** Viewport heights of scroll the whole gesture is spread across. */
  length?: number;
  /** The film's own aspect ratio, so the frame never crops it. */
  aspect?: number;
}

/**
 * The headline, then the film.
 *
 * The page opens on a single statement at poster weight with a small silent
 * loop held below it, roughly the size of a card. Scrolling does two things at
 * once: the words lift up out of the frame, and the film grows from that card
 * to full bleed. By the time the sentence has gone the picture is the whole
 * screen, and the reader did all of it — nothing here plays on entry.
 *
 * Width and height are animated rather than a scale transform on purpose, and
 * both are pinned to the film's own aspect ratio, so at every size between the
 * card and the final frame the whole picture is on screen. Nothing is cropped
 * to fit and nothing is stretched: the frame opens *around* the performance
 * rather than inflating it or trimming it.
 *
 * Reduced-motion visitors get the end state — headline above, film wide and
 * still playing — which is the same information without the travel.
 */
export function Overture({
  src,
  srcSmall,
  poster,
  children,
  length = 2,
  aspect = 16 / 9,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Scroll position drives the gesture, but not directly: a wheel or a
  // trackpad delivers position in coarse jumps, and mapping those straight
  // onto a growing frame makes the growth step rather than glide. The spring
  // is what turns the jumps into travel — critically damped enough that it
  // never wobbles past its target, loose enough to keep up with a fast flick.
  const smooth = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 40,
    mass: 0.35,
    restDelta: 0.0005,
  });

  // Mapped across the whole section, not part of it. Finishing early leaves
  // the rest of the sticky section as scroll that changes nothing: the film
  // has stopped growing but the page has not started moving again, which is
  // felt as the frame catching on something. Ending exactly where the section
  // releases means the last frame of the gesture and the first frame of the
  // page moving on are the same frame.
  //
  // Linear, for the same reason. An ease-out spends its last third creeping
  // the final few percent, which reads as the same stall in miniature — the
  // spring above is what makes the motion smooth, so the curve does not have
  // to be. Clamped only because a spring can overshoot its target.
  const open = useTransform(smooth, [0, 1], [0, 1], { clamp: true });

  // The card starts a little over a centimetre wider and taller than a
  // straight 30vw/26vh: measured against a 1440x800 screen, where 1cm is
  // ~2.6vw across and ~4.7vh down. It stops short of full bleed — a frame that
  // runs to the exact edge of the window reads as a background the page
  // happens to sit on, and leaving a couple of centimetres of void around it
  // keeps it a *picture*, which is what the whole gesture has been opening.
  //
  // Both bounds are ceilings, not the size. The frame takes whichever of the
  // two the film's own aspect ratio can fit inside, so it is never a shape the
  // video has to be cropped to fill: on a wide window the height binds, on a
  // tall one the width does, and object-cover has nothing left to cut either
  // way. Sizing to a fixed vw/vh pair instead threw away about an eighth of
  // the frame's height on an ordinary laptop.
  const w = useTransform(open, [0, 1], [32.6, 94]);
  const h = useTransform(open, [0, 1], [30.7, 84]);
  const width = useMotionTemplate`min(${w}vw, calc(${h}vh * ${aspect}))`;
  const height = useMotionTemplate`min(${h}vh, calc(${w}vw / ${aspect}))`;
  // The card sits low, under the headline; it rises into the middle of the
  // screen as it grows, which is what makes the two movements read as one.
  const filmY = useTransform(open, [0, 1], ["30vh", "0vh"]);

  // The words are gone by the time the frame is two thirds open, so they never
  // sit on top of the picture competing with it.
  const copyY = useTransform(open, [0, 1], ["-14vh", "-88vh"]);
  const copyOpacity = useTransform(open, [0, 0.42, 0.62], [1, 1, 0]);

  // Autoplay is declarative, but Safari will refuse the promise if the tab was
  // opened in the background; a play() on first paint recovers that case.
  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  /*
   * There was a piece of edge treatment here — a gradient deepening the black
   * toward the section's bottom, and a lit hairline along it — and it is gone
   * with the ground it belonged to.
   *
   * Its whole job was to give the #070707 slab a body where it stepped down
   * to the page's #000: the contrast made the edge, and this gave the surface
   * above it thickness. The section paints no ground of its own now, so both
   * sides of that line are the same black and there is no step for it to
   * dress. Left in, it drew a hairline across a continuous page and killed
   * the page's own points in the 96px above it — a boundary where the design
   * no longer has one. The film's bottom edge is the edge, and it is a
   * stronger one than the hairline ever was.
   */

  /*
   * The film is the first thing on the page, so its bytes are the first thing
   * asked for, and both halves of that request are cut to the smallest shape
   * that still reads.
   *
   * The <source> list is the size half. `srcSmall` carries a `media` query, so
   * a phone fetches the narrow cut and a desktop skips straight past it to
   * `src` — the browser picks exactly one and never touches the other. The
   * choice is made once, during resource selection on mount, which is the
   * right time for it: the frame grows with the scroll but the screen it is
   * growing on does not change size mid-gesture.
   *
   * `preload="auto"` is the latency half, and it is deliberate rather than
   * left at the default. Both cuts are written with the moov atom in front of
   * the media data, so the decoder has the index after the first few kilobytes
   * and can start drawing from the front of the file instead of waiting for
   * the end of it. Asking for `auto` lets the browser run that download flat
   * out from first paint; `metadata` would have it stop after the header and
   * pick the rest up again only once autoplay asked, which is a second round
   * trip on the critical path for no saving — the clip is silent, short and
   * always played.
   */
  const film = (
    <video
      ref={videoRef}
      poster={mediaUrl(poster)}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className="h-full w-full object-cover"
    >
      {srcSmall && (
        <source
          src={mediaUrl(srcSmall)}
          type="video/mp4"
          media="(max-width: 820px)"
        />
      )}
      <source src={mediaUrl(src)} type="video/mp4" />
    </video>
  );

  if (reduced) {
    return (
      <section className="relative px-6 pt-32 pb-16 md:px-12">
        <div className="w-full text-center">{children}</div>
        <div
          style={{ backgroundColor: OPENING_BLACK }}
          className="relative mt-16 h-[70vh] w-full overflow-hidden"
        >
          {film}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      style={{ height: `${length * 100}vh` }}
      className="relative"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* The film. Flex-centred so only y and the frame's size animate — no
            transform is spent on the centring itself. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            style={{ width, height, y: filmY, backgroundColor: OPENING_BLACK }}
            className="relative overflow-hidden rounded-[2px]"
          >
            {film}
          </motion.div>
        </div>

        {/* The headline, riding up over it. */}
        <motion.div
          style={{ y: copyY, opacity: copyOpacity }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 md:px-12"
        >
          <div className="pointer-events-auto w-full text-center">
            {children}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
