# Media on Cloudflare R2

Images, video and audio are served from an R2 bucket in production and from
`public/media/` in local development. **The path is the same in both cases**,
so nothing in the content changes when you switch.

```
content field         stored value                          served from
--------------------  ------------------------------------  ------------------------------
poster                /media/posters/<slug>.jpg             <R2 base>/media/posters/<slug>.jpg
videoSrc              /media/video/<slug>.mp4               <R2 base>/media/video/<slug>.mp4
previewSrc            /media/preview/<slug>-480.mp4         <R2 base>/media/preview/<slug>-480.mp4
tracks[].audioSrc     /media/audio/<slug>.mp3               <R2 base>/media/audio/<slug>.mp3
portraits[]           /media/portraits/portrait-N.jpg       <R2 base>/media/portraits/portrait-N.jpg
```

`src/lib/media.ts` is the only place that makes that decision. With
`VITE_R2_PUBLIC_URL` unset it returns the path as-is (served out of `public/`);
with it set it prefixes the base URL. Absolute `https://` values always pass
through untouched, so one-off assets can live anywhere.

---

## Where to put your files

Drop the real files here, using these exact names:

| What | Path | Notes |
|---|---|---|
| Performance still | `public/media/posters/<slug>.jpg` | Any ratio — set `aspect` to match. `<slug>` must match the content `slug`. |
| Performance video | `public/media/video/<slug>.mp4` | **H.264/AAC.** HEVC decodes only where the OS provides it (Safari, Chrome on Apple silicon) — Firefox and most Windows/Linux machines get nothing. |
| Index-wall preview | `public/media/preview/<slug>-480.mp4` | ~8s, silent, 480px, 15fps. Size is in the name on purpose — see below. |
| Track audio | `public/media/audio/<slug>.mp3` | Lifted off the recording; drives the waveform player. |
| Portrait | `public/media/portraits/portrait-N.jpg` | 4:5, for the About strip. |
| Gallery still | `public/media/posters/<name>.jpg` | Any name; referenced from `gallery[]`. |

All three files for one entry share the slug, so renaming an entry means
renaming the video, the preview and the poster together.

### Why there are three media files per entry

`videoSrc` is the full recording, fetched only on a detail page.

`previewSrc` is the loop the index wall plays. **Every tile in frame plays at
once** — around 54 of them on a laptop screen — so the binding constraint is
concurrent *decode*, not download. That is why the cut is 480px at 15fps
rather than something prettier: roughly a third of the decode cost of 640/30.
All 36 together are 2.4 MB, against 1.1 GB of full recordings.

The `-480` suffix is load-bearing. Objects carry an immutable one-year cache
header, so re-cutting a preview at a new size must land under a **new key** or
browsers and Cloudflare's edge keep serving the old, heavier file. Bump the
suffix whenever the cut changes.

`tracks[].audioSrc` is the soundtrack lifted off the recording, so the
waveform player on the detail page has something real to play. It is extracted
from the original source rather than the transcode, so the remuxed files avoid
a second lossy generation. 96 MB across the 36 entries.

A tile with no `previewSrc` falls back to `videoSrc`, and an entry with
neither falls back to a slow Ken Burns move on the poster.

### Aspect ratio

`aspect` (width ÷ height) is stored per entry because the archive is a mix of
landscape and portrait phone footage. Tiles are cut to it, then normalised to
equal *area* in `src/components/gallery/layout.ts`, so a 9:16 clip sits on the
wall at the same visual weight as a 16:9 one instead of towering over it.
Omit `aspect` and the tile falls back to 16:9.

### Regenerating from source footage

`scripts/ingest-video.mjs` does the whole conversion in one pass — it remuxes
anything already web-safe, transcodes anything that is not (HEVC, >1280px,
rotated), then writes the poster and the preview loop:

```bash
node scripts/ingest-video.mjs "~/Downloads/Solo Concerts" --category solo-concert
node scripts/ingest-video.mjs --help
```

Then reference them in the content:

- **Bundled content** — `src/data/performances.ts` (`poster`, `gallery`,
  `videoSrc`, `tracks[].audioSrc`) and `src/data/site.ts` (`portraits`).
- **Supabase content** — the same columns in the `performances` /
  `profile` tables (`video_src` in Postgres). See `DATABASE.md`.

`videoSrc` and `previewSrc` are optional everywhere: tiles and the detail
player fall back to a slow Ken Burns move on the poster when they are absent,
so adding footage is purely additive.

### CORS is required — do not remove it

Plain `<video src>` playback needs no CORS. **Audio does**, because the
waveform player routes the `<audio>` element through a Web Audio
`AnalyserNode`, and `createMediaElementSource()` on a cross-origin file
fetched without CORS produces **silence** — the element still reports as
playing, the clock still advances, and nothing throws. Media is served from
r2.dev, a different origin from the site, so this is not a hypothetical.

Two halves, both needed:

1. The `<audio>` element sets `crossOrigin="anonymous"`
   (`src/components/audio/WaveformPlayer.tsx`).
2. The bucket returns `Access-Control-Allow-Origin`. The policy lives in
   `infra/r2-cors.json` and is applied with:

   ```bash
   npx wrangler r2 bucket cors set sanjana-portfolio-media --file infra/r2-cors.json
   npx wrangler r2 bucket cors list sanjana-portfolio-media   # verify
   ```

Origins are `*`, which grants nothing extra: the bucket is already
world-readable over r2.dev, and CORS only governs cross-origin *script*
access to bytes anyone can already fetch. `Range` is in the allowed headers
and `Content-Range`/`Accept-Ranges` in the exposed ones, or seeking breaks.

Verify with:

```bash
curl -sI -H 'Origin: https://example.test' \
  https://pub-7b43e56065be4b36a1057c48e7f327af.r2.dev/media/audio/hindi-singing-2025-01.mp3 \
  | grep -i access-control
```

If the policy is ever lost, the engine degrades rather than going silent: it
catches the failure and plays the element straight to the speakers, losing
only the analyser's reaction to the waveform.

---

## One-time R2 setup

1. ~~**Enable R2**~~ — done.

2. ~~**Create the bucket**~~ — done: **`sanjana-portfolio-media`**
   (Standard storage, ENAM). To recreate it elsewhere, or under another name
   that you then pass as `R2_BUCKET` (see step 5):

   ```bash
   npx wrangler r2 bucket create sanjana-portfolio-media
   ```

3. ~~**Make it publicly readable**~~ — done, via the r2.dev subdomain:

   ```
   https://pub-7b43e56065be4b36a1057c48e7f327af.r2.dev
   ```

   Note that r2.dev is **rate-limited by Cloudflare and not intended for
   production traffic**. Before launch, attach a custom domain (Bucket →
   *Settings* → *Public access* → *Custom domain*, e.g.
   `media.sanjana.example` on a zone in the same account) and change
   `VITE_R2_PUBLIC_URL` to it. Nothing else needs to change — the object keys
   stay the same.

4. **Add CORS** if you serve video/audio from a different hostname than the
   site. Bucket → *Settings* → *CORS policy*:

   ```json
   [
     {
       "AllowedOrigins": ["https://your-site.example", "http://localhost:5173"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range"],
       "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   The `Range` entries matter: without them the `<video>` and `<audio>`
   elements cannot seek.

5. **Point the app at it.** In `.env` (and in your host's environment
   variables — Vercel/Netlify/Pages project settings):

   ```
   VITE_R2_PUBLIC_URL=https://pub-7b43e56065be4b36a1057c48e7f327af.r2.dev
   R2_BUCKET=sanjana-portfolio-media
   ```

   `VITE_R2_PUBLIC_URL` is baked in at build time, so redeploy after changing
   it. `R2_BUCKET` is only read by the upload script and never reaches the
   browser.

---

## Uploading

```bash
npx wrangler login          # once — or export CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npm run media:upload -- --dry-run   # see what would be sent
npm run media:upload                # send it
```

The script walks `public/media/`, uploads each file to the key that mirrors
its path (`public/media/posters/x.jpg` → `media/posters/x.jpg`), sets the
right `Content-Type`, and applies a one-year immutable `Cache-Control`.

Because the cache header is immutable, **replace an asset by uploading it
under a new filename** and updating the content, rather than overwriting the
same key — otherwise browsers and Cloudflare's edge keep serving the old file.

An API token for CI needs the **Workers R2 Storage: Edit** permission.

### Keeping the files out of git

Once everything is in R2 you can stop committing the binaries — add to
`.gitignore`:

```
public/media/video/
public/media/preview/
public/media/audio/
```

That is ~1.2 GB between them. Posters and portraits stay committed.

Keep posters and portraits in the repo if you want the site to still render
offline with `VITE_R2_PUBLIC_URL` unset; they are small. Video and audio are
the ones worth removing.

---

## Verifying

```bash
curl -I https://pub-7b43e56065be4b36a1057c48e7f327af.r2.dev/media/posters/honor-choir-2025-02.jpg
```

Expect `200`, the right `content-type`, and
`cache-control: public, max-age=31536000, immutable`. A `401`/`403` means
public access is still off; a `404` means the key does not match the content
path — compare it against the table at the top of this file.
