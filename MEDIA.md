# Media on Cloudflare R2

Images, video and audio are served from an R2 bucket in production and from
`public/media/` in local development. **The path is the same in both cases**,
so nothing in the content changes when you switch.

```
content field         stored value                          served from
--------------------  ------------------------------------  ------------------------------
poster                /media/posters/<slug>.jpg             <R2 base>/media/posters/<slug>.jpg
videoSrc              /media/video/<slug>.mp4               <R2 base>/media/video/<slug>.mp4
previewSrc            /media/preview/<slug>.mp4             <R2 base>/media/preview/<slug>.mp4
tracks[].audioSrc     /media/audio/<track-id>.mp3           <R2 base>/media/audio/<track-id>.mp3
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
| Hover preview | `public/media/preview/<slug>.mp4` | ~8s, silent, 640px long side. See below. |
| Track audio | `public/media/audio/<track-id>.mp3` | `<track-id>` matches `tracks[].id`. |
| Portrait | `public/media/portraits/portrait-N.jpg` | 4:5, for the About strip. |
| Gallery still | `public/media/posters/<name>.jpg` | Any name; referenced from `gallery[]`. |

All three files for one entry share the slug, so renaming an entry means
renaming the video, the preview and the poster together.

### Why there are two video files per entry

`videoSrc` is the full recording and is only ever fetched on a detail page.
`previewSrc` is the short silent loop the index wall plays on hover — the wall
mounts a `<video>` for whichever tile the cursor is over, so pointing that at a
four-minute file would pull down tens of megabytes per hover. The previews for
the current 36 entries total **5.7 MB**; the full recordings total **1.1 GB**.

A tile with no `previewSrc` falls back to `videoSrc`, and an entry with neither
falls back to a slow Ken Burns move on the poster.

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

Media elements are plain `<video src>` with no `crossorigin` attribute, so
cross-origin playback and seeking work off r2.dev without a CORS policy. Add
one only if something starts fetching media with `fetch`/XHR.

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
