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
  accent: string
  cover?: string
  tracks: Track[]
  href: string
}

/**
 * The listening shelf: one card a discipline, built from the archive.
 *
 * Nothing here is a second copy of the work. A card *is* its category — every
 * recording filed under it, in the order it was performed — so a new piece in
 * `performances.ts` turns up in the right card with nothing else to edit. The
 * only hand-picked value is the cover, in `data/music.ts`.
 *
 * Two columns of unequal width, cards alternating between them, which is what
 * gives the shelf its stagger: the left card runs deeper than the right one
 * beside it, so no two rows ever line up.
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
          accent: c.accent,
          cover: MUSIC_COVERS[c.id] ?? pieces[pieces.length - 1]?.poster,
          tracks,
          href: `/work?category=${c.id}`,
        },
      ]
    }).sort((a, b) => b.tracks.length - a.tracks.length)
  }, [items])

  /** Only one card sounds at a time; the rest hand the transport over. */
  const [activeId, setActiveId] = useState<CategoryId | null>(null)

  if (!albums.length) return null

  const columns: Album[][] = [
    albums.filter((_, i) => i % 2 === 0),
    albums.filter((_, i) => i % 2 === 1),
  ]

  return (
    <section className="mx-auto max-w-[1600px] px-6 pb-32 md:px-12">
      <Reveal>
        <p className="label mb-4 text-dust">Listen</p>
        <p className="max-w-2xl text-sm leading-[1.9] font-light text-mist">
          One sleeve a discipline, holding every recording filed under it. The
          audio is lifted straight off the footage rather than re-recorded, so
          what plays here is the room as it sounded.
        </p>
      </Reveal>

      <div className="mt-16 grid items-start gap-4 md:gap-6 lg:grid-cols-[1.35fr_1fr]">
        {columns.map((column, col) => (
          <div key={col} className="grid min-w-0 gap-4 md:gap-6">
            {column.map((a, i) => (
              <Reveal key={a.id} delay={i * 0.08} y={34} className="min-w-0">
                <AlbumCard
                  id={a.id}
                  album={a.album}
                  artist={PROFILE.name}
                  cover={a.cover}
                  accent={a.accent}
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
