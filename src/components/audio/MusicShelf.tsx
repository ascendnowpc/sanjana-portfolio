import { useMemo, useState } from 'react'
import type { CategoryId, Performance, Track } from '@/types/content'
import { CATEGORIES } from '@/data/categories'
import { MUSIC_COVERS } from '@/data/music'
import { PROFILE } from '@/data/site'
import { Reveal } from '@/components/ui/Reveal'
import { AlbumCard } from '@/components/audio/AlbumCard'

interface Album {
  id: CategoryId
  album: string
  cover?: string
  tracks: Track[]
  href: string
}

/**
 * How many cards the narrow column takes for each one the wide column does.
 *
 * A cover is square, so a card's height is mostly its column's width, and the
 * wide column is close to twice the narrow one. Two narrow cards a wide one
 * therefore keeps the columns roughly level — and because the list is sorted
 * deepest-first, it also puts the biggest bodies of work in the biggest
 * sleeves, which is the shape the reference has.
 */
const NARROW_PER_WIDE = 2

/**
 * The listening shelf: one card a discipline, built from the archive.
 *
 * Nothing here is a second copy of the work. A card *is* its category — every
 * recording filed under it, in the order it was performed — so a new piece in
 * `performances.ts` turns up in the right card with nothing else to edit. The
 * only hand-picked value is the cover, in `data/music.ts`.
 *
 * Two columns of unequal width — the wide one nearly twice the narrow — which
 * is what gives the shelf its stagger: the left card runs deeper than the
 * right one beside it, so no two rows ever line up.
 *
 * Which card lands in which column is not an alternation. A card's cover is
 * square, so its height is mostly its column's width: split six cards evenly
 * and the wide side runs half a screen past the narrow one. See
 * NARROW_PER_WIDE.
 */
export function MusicShelf({ items }: { items: Performance[] }) {
  const albums = useMemo<Album[]>(() => {
    const byCategory = new Map<CategoryId, Performance[]>()
    for (const p of items) {
      const list = byCategory.get(p.category)
      if (list) list.push(p)
      else byCategory.set(p.category, [p])
    }

    return CATEGORIES.flatMap((c) => {
      const pieces = (byCategory.get(c.id) ?? [])
        // Slugs are `<category>-<year>-<nn>`, numbered by date, so this is
        // the running order the discipline was actually performed in.
        .slice()
        .sort((a, b) => a.year - b.year || a.slug.localeCompare(b.slug))

      const tracks = pieces.flatMap((p) => p.tracks)
      if (!tracks.length) return []

      return [
        {
          id: c.id,
          album: c.label,
          cover: MUSIC_COVERS[c.id] ?? pieces[pieces.length - 1]?.poster,
          tracks,
          href: `/work?category=${c.id}`,
        },
      ]
    }).sort((a, b) => b.tracks.length - a.tracks.length)
  }, [items])

  const columns = useMemo(() => {
    const packed: Album[][] = [[], []]
    albums.forEach((a, i) => {
      packed[i % (NARROW_PER_WIDE + 1) === 0 ? 0 : 1].push(a)
    })
    return packed
  }, [albums])

  /** Only one card sounds at a time; the rest hand the transport over. */
  const [activeId, setActiveId] = useState<CategoryId | null>(null)

  if (!albums.length) return null

  return (
    /* Narrower than the rest of the page on purpose. The shelf stops growing
       at ~1144px of content, so on a wide screen it sits in the middle with
       real margin either side rather than running the full 1600 — cards that
       fill a 1920 display stop reading as record sleeves and start reading as
       page sections. */
    <section className="mx-auto max-w-[1240px] px-6 pb-32 md:px-12">
      <Reveal>
        <p className="label mb-4 text-dust">Listen</p>
        <p className="max-w-2xl text-sm leading-[1.9] font-light text-mist">
          One sleeve a discipline, holding every recording filed under it. The
          audio is lifted straight off the footage rather than re-recorded, so
          what plays here is the room as it sounded.
        </p>
      </Reveal>

      {/* The wide column opens up only at xl. Held at 1.9 all the way down,
          the narrow card runs out of room for its own transport row before
          the layout collapses to one column. */}
      <div className="mt-16 grid items-start gap-5 md:gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-12 xl:grid-cols-[1.9fr_1fr]">
        {columns.map((column, col) => (
          <div key={col} className="grid min-w-0 gap-5 md:gap-6 lg:gap-12">
            {column.map((a, i) => (
              <Reveal key={a.id} delay={i * 0.08} y={34} className="min-w-0">
                <AlbumCard
                  id={a.id}
                  album={a.album}
                  artist={PROFILE.name}
                  cover={a.cover}
                  tracks={a.tracks}
                  href={a.href}
                  featured={col === 0}
                  active={activeId === a.id}
                  onPlay={() => setActiveId(a.id)}
                />
              </Reveal>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
