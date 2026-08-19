# Which database to use

**Short answer: Supabase for the data, and keep the video and audio files out of it.**

Nothing in the site requires a database today — it ships with the content in
`src/data/` and runs entirely static. Add Supabase when Sanjana wants to add a
concert without a developer touching the repo.

---

## The recommendation

### Supabase — free, Postgres, and the right shape for this site

| | Free tier |
|---|---|
| Database | 500 MB Postgres |
| API requests | Unlimited |
| Bandwidth | 5 GB / month |
| File storage | 1 GB |
| Auth | 50,000 monthly active users |
| Projects | 2 (they pause after 1 week of no traffic — any visit wakes them) |

Why this one:

- **It is real Postgres.** The content here is relational — a performance has
  many tracks, many credits, many stills. That models cleanly in SQL, and
  `supabase/schema.sql` already does it, including a `performances_full` view
  that returns the exact JSON shape the TypeScript model expects. One request
  fills the whole site.
- **It has an auto-generated REST API.** `src/lib/supabase.ts` talks to it with
  ~40 lines of `fetch` and no SDK, so the bundle does not grow at all.
- **Row Level Security is built in.** The schema grants public read and defines
  no write policy, so the anon key in the browser is read-only by construction.
- **There is a usable admin UI out of the box.** Sanjana can add a show from
  the Supabase table editor without any custom CMS being built.
- **Auth and Storage are there when needed** — for a private admin page later,
  or for hosting the images.

The catch: **5 GB/month of bandwidth and 1 GB of storage is not enough for
video.** That is the one thing to plan around.

### Where the video and audio should live

Never store media as blobs in Postgres, and on the free tier don't serve video
from Supabase Storage either — one popular concert clip will exhaust the
monthly bandwidth. The content model already assumes this: `poster`,
`videoSrc` and `audioSrc` are plain strings, so they can point anywhere, and
`VITE_MEDIA_BASE_URL` rewrites relative paths onto a CDN.

Pick one:

| Option | Free tier | Best when |
|---|---|---|
| **Cloudflare R2** ← recommended | 10 GB storage, **zero egress fees**, 1M writes/mo | You want to keep the custom player and never think about bandwidth |
| **Cloudinary** | ~25 GB storage *or* bandwidth per month, automatic transcoding + adaptive streaming | You want files transcoded for you and don't want to configure anything |
| **YouTube / Vimeo unlisted** | Unlimited | You accept their player and branding, and want zero infrastructure |
| **Mux** | Trial credits only, then paid | Later, if this becomes a real streaming product |

**R2 is the standout free option** because egress is free — that is the cost
that actually bites on a video portfolio. Upload the mp4s and posters, put a
custom domain in front, set `VITE_MEDIA_BASE_URL` to it, and the existing
components stream from it with no code change.

A good split: **Supabase for the rows, R2 for the files.**

### Alternatives, and why not

- **Neon** — excellent serverless Postgres, generous free tier, and it does not
  pause. But no storage, no auth, and no table-editor UI, so you would end up
  building the admin surface yourself.
- **MongoDB Atlas** (512 MB free) — fine, but this content is relational, and
  you would hand-roll the joins the SQL view already does.
- **Turso / libSQL** — very generous, very fast, great for edge reads. Weaker
  browser story: you'd want an API layer in front, which this site doesn't have.
- **Firebase** — Firestore's free tier is fine, but Cloud Storage now requires
  billing enabled, which defeats the point here.
- **PocketBase** — lovely single binary, but it needs a server you maintain.
  Supabase's free tier removes that job.

---

## Turning it on

The site works with none of this. When you want it:

**1. Create the project** at [supabase.com](https://supabase.com) → New project.

**2. Run the schema.** Dashboard → SQL Editor → New query → paste all of
`supabase/schema.sql` → Run.

**3. Add the keys.** Copy `.env.example` to `.env` and fill in Settings → API:

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

The anon key is *meant* to be public — RLS is what protects the data. Never put
the `service_role` key in this file; it bypasses RLS entirely.

**4. Move the content across.** Insert rows matching the fields in
`src/data/performances.ts`. Fastest path for the first load: open the table
editor and use *Insert → Import data from CSV*, or paste an `insert` statement.

```sql
insert into performances (slug, title, subtitle, category, year, venue, city,
                          blurb, description, poster, featured, accent)
values ('midnight-bloom-live', 'Midnight Bloom', 'Solo Concert — The Grand Arena',
        'solo-concert', 2025, 'The Grand Arena', 'Mumbai',
        'Ninety minutes, one voice…', 'The closing night…',
        '/media/posters/midnight-bloom-live.jpg', true, '#4fd8e8');

insert into tracks (id, performance_slug, title, composer, duration, position)
values ('mb-1', 'midnight-bloom-live', 'Paper Lanterns', 'Sanjana', 254, 0);
```

**5. Restart the dev server.** That's it — no component changes. `src/lib/content.ts`
sees the env vars and switches source.

## How the fallback behaves

`src/lib/content.ts` is the only file that knows where content comes from:

- **No env vars** → bundled data from `src/data/`. Zero network, works offline.
  This is the default.
- **Env vars set** → reads `performances_full`, ordered by year.
- **Env vars set but the request fails** (project paused, network down, bad
  key) → logs a warning and falls back to the bundled data.

So a database outage degrades to a stale-but-working site rather than a blank
page. Keep `src/data/performances.ts` populated for that reason, even after
Supabase is live.

## If you outgrow the free tier

The first limit you'll hit is bandwidth, and it will be media, not rows — which
is exactly why the media lives on R2 or Cloudinary. Supabase Pro is $25/month
and lifts the database to 8 GB with 250 GB egress. The row data for a portfolio
of this size is well under 5 MB; you are very unlikely to outgrow the free
database itself.
