# Editing the site

There are two ways in, and they edit the same content.

**On the site.** Sign in, turn on edit mode, and the page becomes the form. The
heading you are reading is the field that holds it; hovering a photograph or a
film offers to replace it. Drop a video on it and the soundtrack is lifted out,
a still is taken, the shape and the length are measured, and every field that
wants one of those is filled — from one file, in one go.

**In the panel at `/admin`.** The same content as a form. Better than the page
for the things a page cannot show — a hex accent, the order of thirty-six
performances, an alt text, a field that has no value yet and therefore nothing
on screen to click — and faster when the job is twelve entries rather than one
word.

Then **Publish**, which is the part that matters: it commits the content to this
repository, and the deploy that follows carries the edit to everybody.

---

## The three states of an edit

Worth knowing, because the bar at the bottom of the screen is always telling you
which one you are in.

| | Where it lives | Who sees it |
|---|---|---|
| **Typed** | this tab | you |
| **Saved** | this browser's local storage | you, on this device, after a reload |
| **Published** | `src/content/published.json`, committed | everybody, once the build finishes |

Saving is not publishing. A saved edit survives a closed tab and reaches nobody
else; that is deliberate, so a half-finished rewrite is not on the live site
while you are thinking about it. Publishing is one press, and about a minute.

Once a publish lands, the local draft is dropped — the deploy has caught up with
it, and keeping it would mean showing you a copy of content that is now in the
code while hiding anything anybody else published since.

---

## Signing in

`/admin`, or the small link at the foot of every page. The password is in the
content itself (Access & data tab), and it is a latch rather than a lock: it is
checked in the browser, so it ships in the JavaScript and anybody who looks can
read it. What it decides is who is *shown* the editing interface.

What it cannot do is change the site. Publishing and uploading go through two
functions that check `ADMIN_PASSWORD` again on the server, and the token that can
write to this repository is never in the page. **Set `ADMIN_PASSWORD` to a
different, longer password than the one in the panel** — that one is public, and
this one is the real lock.

The session lasts until the browser is closed. Edit mode itself is a switch on
the bar, and Escape turns it off — useful for looking at what you have just done
without the dashed outlines over it.

---

## Editing on the page

- **Words.** Click one and type. Enter finishes; Escape puts back what was there
  before. Pasting arrives as plain text, so a sentence dragged out of a document
  does not bring its font with it.
- **Paragraphs.** Same, and Enter inserts a line break instead of finishing.
- **Lists** — the lines of the About statement, the words of the index sentence,
  the portraits, the credits, the stills — get four small buttons: earlier,
  later, add after, remove.
- **Pictures, films and recordings.** Hover the frame and press Replace.
- **Everything else** has a small key marked with a `▸` that opens that part of
  the panel in a sheet beside the page, against the same live content, so the
  page keeps updating behind it.

Two places deliberately look different while you are editing. The testimonial
run becomes a grid, because its three screens of scroll-driven horizontal
movement are unusable with a caret in them. Titles that normally animate one
letter at a time become plain text, for the same reason.

A word about slots: some values contain `{name}`, `{year}`, `{title}`,
`{percent}`. Those are substituted when the page renders. Edit mode shows you the
template rather than the filled-in string, so the slot can be kept — a template
that loses one simply stops substituting, and nothing throws.

---

## Replacing a video

This is the part that does real work, and it does it in your browser rather than
on a server.

1. Drop the file. It is probed for its length and its shape.
2. A still is taken from a third of the way in — past the walk-on, before the
   applause.
3. `ffmpeg`, compiled to WebAssembly, extracts the soundtrack as a 128k mp3, and
   optionally cuts the eight-second silent 480px loop the archive wall hovers
   with.
4. The film is uploaded, then each derived file.
5. Every field that wants one of those is written: the film, the audio (onto the
   piece's first track, or a track built for it), the poster, the hover loop, the
   aspect ratio, the runtime.

Notes on the edges:

- The first video in a tab downloads about **31 MB** of video tools. After that
  it is cached.
- Files over about **400 MB** upload as they are, with the derivations skipped —
  the WebAssembly build addresses memory in 32 bits and the whole input has to be
  resident. Use `scripts/ingest-video.mjs` for those; it is the same pipeline with
  a real ffmpeg behind it.
- Each derivation can fail on its own and says so rather than failing the upload.
  A file this browser cannot decode — HEVC on a machine with no system decoder —
  still uploads, and is worth converting first, because a visitor's browser
  probably cannot decode it either.
- **Every upload lands at a new key.** The bucket serves media with a year-long
  immutable cache header, so replacing a file *at the same key* would change
  nothing any browser or edge cache would ever look at again. Replacing a video
  means the content points somewhere new, which is the only kind of replacement
  that is visible.

---

## Musical covers

The About page's listening band has two keys: **Recordings**, which is the
archive filed by discipline, and **Musical covers**, which is songs she did not
write. They are separate because they are different claims — a recording of a
concert has a venue and a date behind it, and the interesting fact about a cover
is whose song it was.

The covers key is hidden from visitors until there is a cover behind it, so a
site with none looks exactly as it did before the key existed. In edit mode it is
always there, with the button that adds the first one.

A cover holds a song title, whose it is, a liner note, a 4:5 sleeve, a video, its
audio and a length. Dropping a video on the sleeve fills the audio, the sleeve
and the length at once. There is also a Musical covers tab in the panel, which is
the faster way to add several.

---

## Setting up publishing

Five minutes, once. Everything above works without it — the edits simply stay in
your browser, and the panel's Export JSON is the way to hand them over.

These go in the deployment's environment (on Vercel: Project → Settings →
Environment Variables), for Production and any preview you edit from.

| | |
|---|---|
| `ADMIN_PASSWORD` | Checked by the two functions. **Not** the panel's password — a longer one. |
| `GITHUB_TOKEN` | A fine-grained personal access token with **Contents: read and write** on this repository, and nothing else. |
| `GITHUB_REPO` | `owner/repo`. Optional on Vercel, which exports it from the build. |
| `PUBLISH_BRANCH` | Optional. Defaults to the branch the deploy was built from, so publishing from a preview commits to that preview's branch. |

Uploading needs four more, from Cloudflare (R2 → Manage API tokens → **Object
Read & Write**, scoped to the one bucket):

| | |
|---|---|
| `R2_ACCOUNT_ID` | The account the bucket belongs to. |
| `R2_ACCESS_KEY_ID` | |
| `R2_SECRET_ACCESS_KEY` | |
| `R2_BUCKET` | Optional; defaults to `sanjana-portfolio-media`. |

And the bucket has to allow the site's origin to PUT — the second rule in
`infra/r2-cors.json`. Put the real hostnames in it and apply it:

```bash
npx wrangler r2 bucket cors set sanjana-portfolio-media --file infra/r2-cors.json
```

Without that rule an upload fails before it starts and the browser will not say
why; see MEDIA.md.

The bar and the panel both ask the deployment what it can do and say plainly what
is missing, so you never find out by pressing the button.

---

## What a publish actually does

`POST /api/publish` verifies the password, then writes the whole content object to
`src/content/published.json` on the deploy's branch through the GitHub contents
API. Pretty-printed, one field to a line, so the commit reads as a commit and can
be reviewed in a pull request like anything else.

`src/lib/contentStore.ts` composes what the site shows from four layers, in order
of authority:

1. The typed data modules under `src/data/` — what the site was built with.
2. `src/content/published.json` — what has been edited since. Empty until the
   first publish.
3. Supabase, if it is configured (see DATABASE.md).
4. Your own unpublished draft, from this browser.

So content has exactly two homes in the repository and no third one to fall out
of step: the data modules, and that one file. Publishing a single changed heading
is a one-line diff.

Nothing is lost by editing in code instead. A value changed in `src/data/` shows
up wherever the published file does not override it — and the published file can
be deleted back to `{ "version": 1, "publishedAt": null, "content": {} }` at any
time to hand authority back to the data modules entirely.

### If a publish fails

The message says which of these it is:

- **401** — `GITHUB_TOKEN` is wrong or has expired.
- **403** — the token needs Contents: read and write on this repository.
- **404** — `GITHUB_REPO` is wrong, or the token cannot reach the repository.
- **409** — somebody else published while yours was in flight. Reload and publish
  again.
- **501** — the deployment has not been given one of the variables above.
- *"no publish endpoint"* — the site is deployed somewhere that does not run the
  functions under `api/`. Export JSON instead.
