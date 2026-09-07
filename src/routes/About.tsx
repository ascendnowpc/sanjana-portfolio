import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { PROFILE } from "@/data/site";
import { usePerformances } from "@/hooks/useContent";
import { Reveal } from "@/components/ui/Reveal";
import { Overture } from "@/components/ui/Overture";
import { MusicShelf } from "@/components/audio/MusicShelf";
import { PortraitStage } from "@/components/about/PortraitStage";
import { Testimonials } from "@/components/about/Testimonials";
import { Starfield } from "@/components/layout/Starfield";
import { mediaUrl } from "@/lib/media";

/**
 * The looping film the About page opens on, in two cuts.
 *
 * The size is in the key on purpose. R2 objects carry an immutable one-year
 * cache header, so a re-cut has to land under a new name or browsers and the
 * edge keep serving the old file — the same rule the preview clips follow.
 * That is why these are new keys rather than the old ones re-encoded in
 * place.
 *
 * The first cut of this was a 1080p master at 7.7 Mbit — eleven megabytes for
 * eleven silent seconds, and the first bytes the page asks for. On anything
 * short of a fast connection the opening frame arrived seconds after the
 * headline it sits under, which is the one thing the whole gesture cannot
 * survive: the sentence lifts away and there is nothing behind it.
 *
 * So the film is graded for delivery rather than for archive. It is a locked
 * camera on a black-and-white shot, and almost all of that bitrate was going
 * on sensor grain in the foliage and the gravel — detail no one is reading at
 * a couple of centimetres of card, and none of it visible once the frame is
 * open either. A light denoise before the encoder takes the grain out, 1440
 * across is still over the frame's own pixel width at full bleed, and the
 * result is about a megabyte and a half: roughly a seventh of the master,
 * with the two frames indistinguishable side by side.
 *
 * Both cuts are written with their index ahead of the media data, so the
 * browser can start drawing from the front of the file instead of waiting for
 * the whole download — the first second of picture is a couple of hundred
 * kilobytes, not the whole clip.
 *
 * The 960 cut is for phones, where the frame is never more than a few hundred
 * points across and the connection is the one most likely to be slow.
 */
const ABOUT_FILM = "/media/video/about-intro-1440.mp4";
const ABOUT_FILM_SMALL = "/media/video/about-intro-960.mp4";

/**
 * The frame the panel holds until the film has enough of itself to play.
 *
 * Also cut down — it was a 1920-wide JPEG at 260KB, spent entirely on a
 * picture that is replaced within a frame or two of arriving, and it was
 * queued ahead of the video it was covering for. At 1280 and a working
 * quality it is a third of that and lands in well under a tenth of a second,
 * which is what a poster is for.
 */
const ABOUT_FILM_POSTER = "/media/posters/about-intro-v2.jpg";

/**
 * The page about Sanjana.
 *
 * Built as a sequence of beats rather than a stack of cards: one idea to a
 * screenful, each arriving off scroll position rather than firing a canned
 * fade the moment it crosses the fold. That is the difference between a page
 * that animates and a page that is *paced* — the reader sets the speed, and
 * nothing happens until they ask for it.
 *
 * The middle of the page is deliberately missing. The statement, the counted
 * archive, the discipline breakdown and the bio prose all came out together:
 * they were written around the placeholder copy in `data/site.ts`, whose
 * credits are invented, and a page is better with a gap in it than with four
 * screens of confident fiction. The opening film runs straight into the
 * recordings until something real goes back in.
 */
export default function About() {
  const { items } = usePerformances();

  const stripRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: stripRef,
    offset: ["start end", "end start"],
  });
  // A drift, not a traverse. The band is narrower than the window now (see
  // the note on its width below), so it is centred rather than bled, and the
  // move is a couple of percent of its own width either side of that centre —
  // enough to keep the band alive as it crosses the viewport, small enough
  // that it never reads as having slipped off its middle.
  const stripX = useTransform(scrollYProgress, [0, 1], ["2.5%", "-2.5%"]);

  return (
    <div className="relative bg-void">
      {/* The field the whole page sits on. It is a sibling of the content
          rather than a layer over it, and the content is lifted above it,
          because points drawn on top of a face read as dirt on the lens. Any
          section that wants to hide them only has to paint its own ground.
          The testimonial run deliberately does not: it pins for three screens
          while the field, which is fixed to the viewport too, holds exactly as
          still as the word behind the cards does. Painting a ground there
          would have swapped a sky the cards travel across for a hole in the
          page three screens deep. */}
      <Starfield />

      <div className="relative z-10">
        {/* ---------------- 1. the room opens ---------------- */}
        <Overture
          src={ABOUT_FILM}
          srcSmall={ABOUT_FILM_SMALL}
          poster={ABOUT_FILM_POSTER}
        >
          {/* Two deliberate lines, not a wrap: at this weight the break is part
              of the composition, and letting the viewport choose it strands a
              single word on line two on half the screens it renders at.

              Leading is above 1, not the sub-1 a display line usually wants.
              Anton's cap height is 0.86em — unusually tall in its em box — so a
              line-height under that closes the channel entirely and the T of
              BUILT lands on top of THE. 1.06 leaves a 0.2em gap, which is the
              proportion the reference holds. Tracking is left a hair open for a
              related reason: the face is already condensed, and pulling it
              tighter fuses the verticals into a picket fence.

              The two lines are also chosen so the second sits *inside* the
              first, the way the reference does it — 6.10em of advance against
              7.03em, so line two lands at about 87% of line one and the block
              tapers instead of squaring off. Both lines being the same length is
              what made the earlier wording read as a slab.

              The size is set off line one's real advance in Anton (7.03em, plus
              tracking), so it lands at roughly three quarters of the viewport
              rather than being tuned by eye per screen. */}
          <h1
            className="font-[family-name:var(--font-poster)] leading-[1.06] tracking-[0.012em] text-white uppercase"
            style={{ fontSize: "clamp(2.3rem, 10.6vw, 16rem)" }}
          >
            A voice for every
            <br />
            room it enters
          </h1>
        </Overture>

        {/* ---------------- 2. the portrait ---------------- */}
        <PortraitStage />

        {/* ---------------- 3. the recordings ---------------- */}
        <MusicShelf items={items} />

        {/* ---------------- 4. portraits over the name ---------------- */}
        {/* The bottom padding is the name's other half, and nothing else. The
            strip clips, so whatever hangs below the pictures has to be given
            room here or it is cut off at the knees. */}
        <div
          ref={stripRef}
          className="relative overflow-hidden pt-16 pb-24 md:pb-36"
        >
          <div className="relative">
            {/* The name, held still.
                It used to drift — a marquee looping the name across the band
                behind the pictures — and standing it still is the whole point
                of this arrangement rather than a simplification of it. A word
                that travels is read as texture: the eye follows it, loses it
                behind a picture, picks up a different letter on the far side,
                and never assembles the name. One instance, centred and
                stationary, is read once and stays read.

                It sits on the pictures' bottom edge rather than in the middle
                of them: `bottom-0` of the box the row fills puts its own
                bottom there, and lifting it by half its height leaves the top
                half behind the stack and the bottom half in the open. Half a
                word is enough to read a name you have already met at the top
                of the page, and a word cut by a hard edge reads as printed
                *under* the pictures rather than laid behind them.

                Hidden from the reading order: the page has already said whose
                it is, in the nav and in the h1, and a third announcement is
                one a screen reader has to sit through rather than glance
                past. */}
            <p
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1/2 text-center font-[family-name:var(--font-poster)] leading-[0.8] tracking-[0.01em] text-edge/60 uppercase select-none"
              style={{ fontSize: "clamp(4rem, 15vw, 14rem)" }}
            >
              {PROFILE.name}
            </p>

            {/* The stack. Flush — no gap and no gutter, so the five read as
                one band across the page rather than as five cards on it.

                78% of the window, which is where the frame size comes from
                rather than the other way round. This band was six frames and
                five gaps filling the width, which put each frame at about
                15.5% of the window; five of those, shoulder to shoulder, come
                to 78%. Sizing the row instead — bleeding five frames edge to
                edge — is the same picture at half again the size, and the
                band stops being a strip along the page and starts being a
                screenful. So the frames keep their size and the band gives up
                the bleed: a margin of void either side, which is also what
                gives the centred name below room to be read against. */}
            <motion.div
              style={{ x: stripX }}
              className="relative mx-auto flex w-[78%]"
            >
              {PROFILE.portraits.slice(0, 5).map((src, i) => (
                <motion.div
                  key={src}
                  className="relative min-w-0 flex-1 overflow-hidden bg-ink"
                  style={{ aspectRatio: "4 / 5" }}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    duration: 0.9,
                    delay: i * 0.07,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <img
                    src={mediaUrl(src)}
                    alt={`${PROFILE.name} — portrait ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover grayscale-[35%] transition-all duration-1000 hover:scale-105 hover:grayscale-0"
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ---------------- 5. testimonials ---------------- */}
        <Testimonials />

        {/* ---------------- 6. the ask ---------------- */}
        <section className="px-6 py-40 text-center md:px-12">
          <Reveal>
            <p className="label text-dust">Next</p>
            <Link
              to="/contact"
              className="tracked mt-8 inline-block text-chalk transition-colors duration-500 hover:text-bloom"
              style={{ fontSize: "clamp(1.8rem, 5vw, 4rem)" }}
            >
              Book a date
            </Link>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
