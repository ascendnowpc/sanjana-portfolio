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
| `/work` | The archive index — grid of frames or list of names |
| `/work/:slug` | A performance: video, recording, credits, stills |
| `/about` | Editorial bio, portrait strip, stats, press |
| `/contact` | Booking enquiry form |
| `/admin` | The panel — password, then every editable value on the site. Signing in here also turns on edit mode on every other page |

`/work` reads `?category=` (`solo-concert`, `musical-theatre`,
`classical-repertoire`, `hindi-singing`, `honor-choir`, `collaboration`) and
`?view=` (`grid`, the default, or `list`), so any state of the index is a
link somebody can send.

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

## The archive index

`/work` is two readings of the same catalogue, switched from the key at the
foot of the page and both built from one `IndexRow` — name on the left,
section at the halfway mark, year and runtime in the last quarter — so a title
sits in the same place whichever way you are reading.

**Grid** bands the archive by category: a heading, then that category's
footage four across and cut to the edges of the screen. **List** drops the
pictures and is nothing but the names.

The hover is the whole interaction. Pointing at one entry drops everything
else to a sixteenth of its opacity and gives the survivor its footage — inside
its own frame in grid view, and filling the viewport behind the type in list
view, where a preview has nowhere else to go. Only the hovered entry is ever
given a decoder; thirty-six simultaneous `<video>` elements is not a thing to
do to a browser. The nav never dims: the page goes down *under* it.

Two details worth not undoing:

- The section keys along the top sit inside the nav bar above ~1560px and drop
  below it under that. Seven category names are considerably wider than the
  reference's four, and at narrower widths they collide with the site name on
  one side and the nav links on the other.
- `IndexRow`'s three columns align on their **centres**, not their baselines.
  A grid item with clipped overflow reports its bottom margin edge as its
  baseline, so the moment a long title needs an ellipsis, baseline alignment
  drops the two small columns to the floor of the row.

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

## Editing the site

Two ways in, editing the same content. **[EDITING.md](./EDITING.md)** is the
full guide; this is the shape of it.

**On the site.** Sign in at `/admin` or from the link at the foot of every page,
turn on edit mode, and the page becomes the form: the heading you are reading is
the field that holds it, and hovering a photograph or a film offers to replace
it. Drop a video on one and the soundtrack is extracted, a still is taken, the
shape and the length are measured, and every field that wants one of those is
filled — in the browser, from one file.

**In the panel at `/admin`.** The same content as a form. Better for what a page
cannot show — a hex accent, the order of thirty-six performances, an alt text, a
field with no value yet and so nothing on screen to click — and faster when the
job is twelve entries rather than one word. Seven tabs:

| Tab | What it edits |
|---|---|
| Profile | Name, role, tagline, bio, training, portraits, press, stats, contacts, social links |
| About page | The opening statement and film, the portrait column, the testimonial cards |
| Performances | All 36 archive entries — every field, plus their tracks, credits and stills |
| Musical covers | The second key of the About page's shelf: songs she did not write |
| Disciplines | The six categories, their accents and cover art, and the recording the index opens on |
| Site text | Every other word on the site: headings, buttons, filter keys, form labels, the welcome sentence, the sound question, the 404 page, and the labels a screen reader hears instead of an icon |
| Access & data | The password, publishing, and export / import / reset |

**Then Publish**, which commits the content to this repository as
`src/content/published.json` and rebuilds the site for everybody. Until then an
edit lives in the editor's own browser, in `localStorage` — it survives a reload
and outlives the tab, and reaches nobody else. That is deliberate: a
half-finished rewrite should not be on the live site while it is being thought
about. **Export JSON** is still there as the other way to hand a draft over.

Publishing needs `ADMIN_PASSWORD` and a `GITHUB_TOKEN` on the deployment, and
uploading needs the R2 keys; both functions live under `api/` and neither secret
ever reaches the browser. The editing bar says plainly when something is missing.
See [EDITING.md](./EDITING.md).

**What the panel's password is worth.** It keeps a passer-by out of the editor. It
is checked in the browser, so it is also shipped to the browser: anyone who reads
the built JavaScript can read it. Nothing behind it is private — every field is
content the site already displays. What it cannot do is change the site for
anybody else: that needs `ADMIN_PASSWORD`, which is checked on the server and
should be a different, longer password.

### How it is wired

```
src/data/*.ts                     the defaults — what the site was built with
  └─ src/content/published.json   what has been edited since, committed by api/publish.ts
       └─ src/lib/contentStore.ts merges: data → published → Supabase → this browser's draft
            └─ src/content/ContentProvider.tsx   serves it to the tree
                 └─ every component, via useProfile() / useUi() / usePerformances()

src/edit/EditProvider.tsx         the session: signed in, edit mode, writes by path
  └─ src/components/edit/*        the fields, the media dialog, the bar and the drawer
```

A later layer wins over an earlier one, and a field added to the model later
still picks up its default, because every layer is re-merged over the one below
it on read rather than replacing it.

Two invariants worth keeping:

- **A string a component holds itself is a string nobody can edit.** New copy
  goes in `src/data/ui.ts`, is typed on `UiCopy`, and is read through `useUi()` —
  never typed into the JSX.
- **A field on the page is the same field in the panel.** Inline editing writes
  by path into the one store the panel writes to, so the two can never be two
  answers. New copy gets a box on the Site text tab as well as its place on the
  page.

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

**Copy.** Either edit `/admin` and export, or edit the defaults directly:
`src/data/performances.ts` (the catalogue), `src/data/site.ts` (bio, links,
press, testimonials), `src/data/categories.ts` (the six sections and their
accents), `src/data/music.ts` (cover art, the index's own recording) and
`src/data/ui.ts` (every other word on the site).

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
│   ├── media/       VideoStage, LoopingPreview
│   ├── works/       the /work index: IndexRow, WorkFrame, Segmented
│   ├── layout/      Nav, Footer, Cursor, Preloader, route transition
│   ├── admin/       the panel's form vocabulary and its seven tab editors
│   ├── edit/        editing in place: fields, the media dialog, the bar, the drawer
│   └── ui/          Reveal, SplitText, Marquee, MagneticLink
├── content/         ContentProvider, and published.json — what has been
│                    edited on the site since, committed into the code
├── routes/          Home, Work, WorkDetail, About, Contact, Admin, NotFound
├── edit/            the editing session: signed in, edit mode, writes by path
├── data/            all content — the defaults the editor starts from
├── lib/             content store, publish and upload clients, the video
│                    pipeline, content repository, Supabase client, helpers
├── hooks/           useAudioEngine, usePointer, useMediaQuery
└── types/           the content model everything speaks

api/                 the two server functions, and the only two secrets
├── publish.ts       commits the content to this repository
└── upload.ts        signs one PUT into the media bucket
```

`src/lib/content.ts` is the only file that knows where content comes *from*, and
`src/lib/contentStore.ts` the only one that decides which layer wins — so
switching to a database, or editing through the panel, never touches a
component.

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
