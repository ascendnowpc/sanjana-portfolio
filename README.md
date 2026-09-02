# SANJANA — vocalist portfolio

A portfolio site for a singer working across solo concerts, musical theatre and
studio sessions. The landing page is an endless 3D wall of stage frames you fly
through; hovering one brings its details up in the centre, clicking one flies
it out to a full page with the video and the recording.

React + TypeScript + Tailwind CSS v4 + React Router. No backend required — see
[DATABASE.md](./DATABASE.md) for the recommendation when you want one.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle
npm run preview
```

> **All content is placeholder.** Every performance, quote and portrait is
> invented, and the stage stills are generated artwork. See
> [Putting the real content in](#putting-the-real-content-in).

---

## Routes

| Route | What it is |
|---|---|
| `/` | The immersive index — the 3D wall |
| `/work` | Filterable reels of everything, newest first, playing |
| `/work/:slug` | A performance: video, recording, credits, stills |
| `/about` | Editorial bio, portrait strip, stats, press |
| `/contact` | Booking enquiry form |

`/work` also reads `?category=` (`solo-concert`, `musical-theatre`,
`studio-session`, `collaboration`) so filtered views are linkable.

### Deploying: these routes need a fallback

Every route above except `/` exists only on the client — `BrowserRouter`
makes them up after `index.html` has booted, and the build contains no file
at any of those paths. Click through to `/about` and it works; reload it and
the host is being asked for a file that was never built, so it answers 404.

Two config files say "serve `index.html` instead", covering the usual hosts:

- `vercel.json` — a catch-all rewrite, for Vercel.
- `public/_redirects` — for Netlify and Cloudflare Pages. It ships to
  `dist/_redirects` because everything in `public/` is copied verbatim.

Both hosts check the filesystem before applying the rule, so real assets are
untouched and only genuinely missing paths reach the fallback. On any other
host, the equivalent is `try_files $uri /index.html` — the deploy needs *some*
form of it, or refresh is broken everywhere but the home page.

## How the index wall works

This is the part worth understanding before changing it.

**Layout** (`src/components/gallery/layout.ts`) places each performance on a
cylindrical shell using golden-angle spacing, with a sqrt-weighted radius so
density stays even instead of clumping toward the middle, and a clear hole in
the centre so the copy always sits on darkness. The catalogue is stacked
several times down the tunnel and wraps modulo the total depth, so the wall
never runs out.

**Motion** (`ImmersiveGallery.tsx`) is one `requestAnimationFrame` loop that
writes `style.transform` directly to registered DOM nodes. The React tree
renders once and then holds still — it only re-renders when the focused tile
changes. Scroll, drag and arrow keys all feed the same `travel` value, which
eases toward its target; ambient drift stops while a tile is focused.

**Each tile carries its own `perspective()`** rather than sharing one on an
ancestor with `transform-style: preserve-3d`. That is deliberate: Chromium
cannot reliably hit-test into a `preserve-3d` subtree, so with the obvious
implementation hover and clicks land on nothing. Because `top:50%` plus the
negative margin put every tile's `transform-origin` on the viewport centre,
they still share one vanishing point and look identical — but they composite
and hit-test as ordinary 2D elements. Paint order then comes from a
depth-derived `z-index`.

**Focus is resolved in the loop**, not from `pointerenter`. The wall drifts
continuously, so a tile slides under a stationary cursor — and a CSS transform
alone never fires a pointer event. Each pass intersects the pointer against the
tiles' rects and picks the frontmost, which runs as a pure read before any
style writes, so it costs no extra layout.

**A drag never navigates**: pointer distance is tracked from `pointerdown`, and
past ~8px the click is suppressed. (The container deliberately does *not* call
`setPointerCapture` — capturing retargets `pointerup` and swallows the click.)

Tiles are `aria-hidden` and not tabbable — they repeat down the tunnel, so
tabbing them would be nonsense. A visually-hidden `<nav>` on the same page
carries the real linear index for keyboard and screen-reader users.

## Audio

The user brief was that the sound matters as much as the video, so the player
is not an afterthought. `WaveformPlayer` draws a 96-bar waveform generated
deterministically from the track id, scrubbable by click or arrow keys, with
the bars near the playhead reacting to a live `AnalyserNode`.

`useAudioEngine` runs in two modes behind one API:

- **`file`** — streams the attached mp3/wav through the analyser.
- **`demo`** — used when no `audioSrc` exists yet: synthesises a slow minor-9
  pad from the track's seed, so the transport, scrubber and visualiser are all
  genuinely exercised rather than mocked. The UI says so on screen.

Drop real files in and the same component switches to `file` mode untouched.

## Putting the real content in

**Media.** Everything lives in `public/media/`. Drop files in and point the
content at them:

```
public/media/posters/<slug>.jpg      still frame, 16:9
public/media/video/<slug>.mp4        optional — see below
public/media/audio/<track-id>.mp3    optional
public/media/portraits/portrait-N.jpg  4:5, for the About strip
```

Those same paths double as object keys in Cloudflare R2. Set
`VITE_R2_PUBLIC_URL` and `npm run media:upload` pushes `public/media/` to the
bucket, after which every path above is served from R2 instead of the bundle —
no content edits. Absolute URLs in the content pass through untouched.
**See [MEDIA.md](MEDIA.md) for the full R2 walkthrough.**

**`videoSrc` is omitted everywhere on purpose.** Tiles and the detail page both
degrade to a slow Ken Burns move on the poster when it is missing, so the site
is complete and shippable before any footage is cut. Add the field and the
video appears — in the tile on hover, and as the hero player on the page.

**Copy.** `src/data/performances.ts` (the catalogue), `src/data/site.ts` (bio,
links, press), `src/data/categories.ts` (the four sections and their accents).

**Placeholder artwork.** The stage stills are generated, not photographed:

```bash
python3 scripts/make_posters.py          # deterministic SVG stage frames
npm i -D playwright                      # dev-only, not a project dependency
node scripts/rasterize.mjs               # SVG -> JPEG
```

Rasterising is not just about file size: the wall rescales every tile on every
frame, and an `<img>` pointing at an SVG re-rasterises on each scale change.
Converting took the wall from ~13fps to ~36fps under software rendering. Real
photography has the same property, so both scripts can be deleted once actual
stills exist.

## Structure

```
src/
├── components/
│   ├── gallery/     ImmersiveGallery, GalleryTile, layout maths
│   ├── audio/       WaveformPlayer
│   ├── media/       VideoStage, VideoReel, LoopingPreview
│   ├── layout/      Nav, Footer, Cursor, Preloader, route transition
│   └── ui/          Reveal, SplitText, Marquee, MagneticLink
├── routes/          Home, Work, WorkDetail, About, Contact, NotFound
├── data/            all content — the single place to edit copy
├── lib/             content repository, Supabase client, helpers
├── hooks/           useAudioEngine, usePointer, useMediaQuery, useContent
└── types/           the content model everything speaks
```

`src/lib/content.ts` is the only file that knows where content comes from, so
switching to a database never touches a component.

## Design

Palette and type live in the `@theme` block at the top of `src/index.css` —
Tailwind v4 needs no config file. The scheme is midnight blue-blacks with one
cold cyan as the only light source; violet, amber and rose are reserved as
per-category accents and flow through each performance page.

Route changes use a clone-and-zoom shared-element transition
(`TransitionProvider`): React Router unmounts the old tree before the new one
paints, so a `layoutId` handoff can't survive it. The clicked tile is cloned
into a fixed layer, flown to full-bleed, and dissolved once the new page has
painted underneath.

`prefers-reduced-motion` is honoured throughout — the wall stops drifting and
floating, the custom cursor and preloader are skipped, and the zoom transition
becomes a plain navigation.

## Notes

- Only `/` ships in the main chunk; every other route is code-split.
- The custom cursor is suppressed on coarse pointers and reduced-motion.
- The contact form is front-end only. Wire it to Supabase or an email service
  before going live — it says so on screen after submitting.
