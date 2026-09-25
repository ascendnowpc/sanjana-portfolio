import { useMemo, useState } from 'react'
import type {
  Category,
  CategoryId,
  Credit,
  Performance,
  Track,
} from '@/types/content'
import {
  Color,
  Group,
  MediaField,
  Num,
  Repeater,
  Row,
  Select,
  StringList,
  Text,
  TextArea,
  Toggle,
} from '@/components/admin/fields'
import type { MediaResult } from '@/components/edit/MediaDialog'

/**
 * The archive — thirty-six pieces by default, every field of every one.
 *
 * Shown as a list that opens one entry at a time rather than as thirty-six
 * stacked forms. Two reasons, and the second is the real one: a page with
 * every field of every piece mounted is thousands of inputs, and somebody
 * editing an entry is editing *that* entry — the other thirty-five are
 * context, and context belongs in a line each.
 */

const BLANK_ASPECT = 1.7778

function blankPerformance(category: CategoryId): Performance {
  return {
    slug: '',
    title: '',
    subtitle: '',
    category,
    year: new Date().getFullYear(),
    venue: '',
    city: '',
    blurb: '',
    description: '',
    poster: '',
    gallery: [],
    credits: [],
    tracks: [],
    aspect: BLANK_ASPECT,
  }
}

export function PerformancesSection({
  items,
  onChange,
  categories,
}: {
  items: Performance[]
  onChange: (next: Performance[]) => void
  categories: Category[]
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [filter, setFilter] = useState<CategoryId | 'all'>('all')
  const [query, setQuery] = useState('')

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.label })),
    [categories],
  )

  /**
   * The rows on screen, paired with their index in the real array.
   *
   * The index travels with the row because every write below is against the
   * full list: filtering the view must not be able to move a piece somebody
   * did not touch. Search matches the title, the slug and the venue, which are
   * the three things anybody actually remembers about an entry.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => filter === 'all' || item.category === filter)
      .filter(
        ({ item }) =>
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.slug.toLowerCase().includes(q) ||
          item.venue.toLowerCase().includes(q),
      )
  }, [items, filter, query])

  const setAt = (index: number, next: Performance) =>
    onChange(items.map((item, i) => (i === index ? next : item)))

  const removeAt = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
    setOpenSlug(null)
  }

  const moveAt = (index: number, delta: number) => {
    const j = index + delta
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }

  const duplicateAt = (index: number) => {
    const copy: Performance = {
      ...structuredClone(items[index]),
      slug: `${items[index].slug}-copy`,
      title: `${items[index].title} (copy)`,
    }
    const next = items.slice()
    next.splice(index + 1, 0, copy)
    onChange(next)
    setOpenSlug(copy.slug)
  }

  const add = () => {
    const piece = blankPerformance(
      filter === 'all' ? (categories[0]?.id ?? ('' as CategoryId)) : filter,
    )
    piece.slug = `new-piece-${items.length + 1}`
    piece.title = 'Untitled piece'
    onChange([...items, piece])
    setOpenSlug(piece.slug)
  }

  return (
    <div className="space-y-6">
      <Group
        title="The archive"
        description="Every performance, in running order. The order here is the order the site reads them in — the music shelf runs top to bottom, and the listing pages sort by year on top of it."
      >
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Filter"
            className="min-w-[12rem]"
            value={filter}
            options={[
              { value: 'all' as const, label: 'All disciplines' },
              ...categoryOptions,
            ]}
            onChange={(v) => setFilter(v as CategoryId | 'all')}
          />
          <Text
            label="Search"
            className="min-w-[14rem] flex-1"
            value={query}
            onChange={setQuery}
            placeholder="Title, slug or venue"
          />
          <button
            type="button"
            onClick={add}
            className="h-[38px] rounded-sm border border-white/25 px-4 text-[0.62rem] tracking-[0.18em] text-white uppercase transition-colors hover:border-white hover:bg-white hover:text-black"
          >
            + Add performance
          </button>
        </div>

        <p className="text-xs text-neutral-500">
          Showing {visible.length} of {items.length}.
        </p>

        <div className="space-y-2">
          {visible.map(({ item, index }) => {
            const open = openSlug === item.slug
            return (
              <div
                key={`${item.slug}-${index}`}
                className="rounded-sm border border-white/10 bg-white/[0.02]"
              >
                <div className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => setOpenSlug(open ? null : item.slug)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="w-4 shrink-0 text-neutral-500">
                      {open ? '−' : '+'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-neutral-100">
                        {item.title || '(untitled)'}
                      </span>
                      <span className="block truncate font-mono text-[0.68rem] text-neutral-500">
                        {item.slug} · {item.category} · {item.year}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <SmallButton
                      label="↑"
                      title="Move up"
                      onClick={() => moveAt(index, -1)}
                      disabled={index === 0}
                    />
                    <SmallButton
                      label="↓"
                      title="Move down"
                      onClick={() => moveAt(index, 1)}
                      disabled={index === items.length - 1}
                    />
                    <SmallButton
                      label="⧉"
                      title="Duplicate"
                      onClick={() => duplicateAt(index)}
                    />
                    <SmallButton
                      label="×"
                      title="Delete"
                      danger
                      onClick={() => removeAt(index)}
                    />
                  </div>
                </div>

                {open && (
                  <div className="border-t border-white/10 p-4 md:p-5">
                    <PerformanceEditor
                      value={item}
                      onChange={(next) => {
                        setAt(index, next)
                        // Follow a renamed slug, or the row closes under the
                        // cursor on the first keystroke.
                        if (next.slug !== item.slug) setOpenSlug(next.slug)
                      }}
                      categoryOptions={categoryOptions}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {!visible.length && (
            <p className="rounded-sm border border-dashed border-white/10 px-4 py-8 text-center text-xs text-neutral-600">
              Nothing matches that filter.
            </p>
          )}
        </div>
      </Group>
    </div>
  )
}

function SmallButton({
  label,
  title,
  onClick,
  disabled,
  danger,
}: {
  label: string
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`h-7 w-7 rounded-sm border border-white/12 text-xs text-neutral-400 transition-colors hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 ${
        danger ? 'hover:border-red-500/60 hover:text-red-400' : ''
      }`}
    >
      {label}
    </button>
  )
}

/** Every field of one piece. */
function PerformanceEditor({
  value,
  onChange,
  categoryOptions,
}: {
  value: Performance
  onChange: (next: Performance) => void
  categoryOptions: { value: CategoryId; label: string }[]
}) {
  const set = <K extends keyof Performance>(key: K, v: Performance[K]) =>
    onChange({ ...value, [key]: v })

  /**
   * One dropped recording, written across six fields at once.
   *
   * Everything in `result` that arrived is used and everything that did not is
   * left alone, so a file the browser could not take a still from keeps the
   * still that is already there rather than blanking it.
   *
   * The soundtrack is the awkward one: a performance keeps its audio on a
   * `Track`, so an extracted mp3 either joins the first track or a whole track
   * has to be built for it — a path written into an empty list would leave a
   * track with a file and no id, title or length.
   */
  const onVideo = (result: MediaResult) => {
    // A still taken from portrait footage is portrait: it is the front page's
    // cover, not the Work page's 16:9 poster, which keeps the one it has and
    // only borrows this one if it has nothing at all.
    const upright = (result.aspect ?? value.aspect ?? BLANK_ASPECT) < 1
    onChange({
      ...value,
      videoSrc: result.key,
      poster: upright
        ? value.poster || result.poster || ''
        : (result.poster ?? value.poster),
      posterPortrait: upright
        ? (result.poster ?? value.posterPortrait)
        : value.posterPortrait,
      previewSrc: result.preview ?? value.previewSrc,
      aspect: result.aspect ?? value.aspect,
      runtime: result.runtime ?? value.runtime,
      tracks: result.audio
        ? value.tracks.length
          ? value.tracks.map((t, i) =>
              i === 0
                ? {
                    ...t,
                    audioSrc: result.audio,
                    duration: result.duration ?? t.duration,
                  }
                : t,
            )
          : [
              {
                id: `${value.slug}-1`,
                title: value.title,
                duration: result.duration ?? 0,
                audioSrc: result.audio,
              },
            ]
        : value.tracks,
    })
  }

  return (
    <div className="space-y-6">
      <Row>
        <Text
          label="Slug"
          mono
          value={value.slug}
          onChange={(v) => set('slug', v)}
          hint="The address of this piece: /work/<slug>. Must be unique."
        />
        <Select
          label="Discipline"
          value={value.category}
          options={categoryOptions}
          onChange={(v) => set('category', v)}
        />
      </Row>

      <Text
        label="Title"
        value={value.title}
        onChange={(v) => set('title', v)}
      />
      <Text
        label="Subtitle"
        value={value.subtitle}
        onChange={(v) => set('subtitle', v)}
        hint="The short line under the title, e.g. “Solo Concert — 2025”."
      />

      <Row>
        <Num
          label="Year"
          value={value.year}
          onChange={(v) => set('year', v)}
        />
        <Text
          label="Runtime"
          value={value.runtime ?? ''}
          onChange={(v) => set('runtime', v || undefined)}
          hint="As written, e.g. “6:21”."
        />
      </Row>

      <Row>
        <Text
          label="Venue"
          value={value.venue}
          onChange={(v) => set('venue', v)}
          hint="Left empty, the detail page drops the row rather than showing a blank."
        />
        <Text
          label="City"
          value={value.city}
          onChange={(v) => set('city', v)}
        />
      </Row>

      <Text
        label="Role"
        value={value.role ?? ''}
        onChange={(v) => set('role', v || undefined)}
        hint="Character or billing, for theatre credits."
      />

      <TextArea
        label="Blurb"
        rows={2}
        value={value.blurb}
        onChange={(v) => set('blurb', v)}
        hint="One sentence. Shown under the title on the index and on the detail page."
      />
      <TextArea
        label="Description"
        rows={5}
        value={value.description}
        onChange={(v) => set('description', v)}
        hint="Long-form copy for the detail page. Left empty, the section is dropped."
      />

      <Row>
        <Toggle
          label="Featured"
          value={Boolean(value.featured)}
          onChange={(v) => set('featured', v || undefined)}
          hint="Pulled forward in the index cloud and on the archive page."
        />
        <Color
          label="Accent"
          value={value.accent ?? ''}
          onChange={(v) => set('accent', v || undefined)}
          hint="Optional. Falls back to the discipline’s own accent."
        />
      </Row>

      <div className="space-y-5 rounded-sm border border-white/10 bg-black/20 p-4">
        <p className="text-[0.62rem] tracking-[0.18em] text-neutral-400 uppercase">
          Media
        </p>
        <MediaField
          label="Poster"
          value={value.poster}
          onChange={(v) => set('poster', v)}
          upload={{ kind: 'poster' }}
          hint="The still shown before anything plays. Cut to 16:9 — that is the shape every frame on the Work page is given."
        />
        <MediaField
          label="Front-page cover (portrait)"
          value={value.posterPortrait ?? ''}
          onChange={(v) => set('posterPortrait', v || undefined)}
          upload={{ kind: 'poster', clearable: true }}
          hint="Only for portrait (phone) footage. The front page hangs portrait footage upright, so it wants a 9:16 still rather than the 16:9 poster above, which the Work page keeps using. Leave it empty and the front page takes a still from the preview loop instead."
        />
        <MediaField
          label="Video"
          kind="video"
          value={value.videoSrc ?? ''}
          onChange={(v) => set('videoSrc', v || undefined)}
          upload={{
            kind: 'video',
            deriveKinds: ['audio', 'poster', 'preview'],
            clearable: true,
            // One dropped recording fills this whole box: the film, its
            // soundtrack as a track, the poster, the hover loop, the shape and
            // the runtime. It is what scripts/ingest-video.mjs does at a
            // terminal, done here instead — see lib/videoPipeline.ts.
            onResult: (result) => onVideo(result),
          }}
          hint="The full recording, played by the detail page. Drop one here and the soundtrack, the still, the hover loop, the aspect ratio and the runtime are all taken from it."
        />
        <MediaField
          label="Preview"
          kind="video"
          value={value.previewSrc ?? ''}
          onChange={(v) => set('previewSrc', v || undefined)}
          upload={{ kind: 'preview', clearable: true }}
          hint="Short silent loop for the hover preview. Falls back to the video, then to a slow move across the poster."
        />
        <Num
          label="Aspect ratio"
          step={0.0001}
          value={value.aspect ?? BLANK_ASPECT}
          onChange={(v) => set('aspect', v)}
          hint="Width ÷ height of the footage: 1.7778 for 16:9, 0.5625 for a portrait phone video. This is what stops vertical footage being cropped into a letterbox strip."
        />
        <StringList
          label="Stills"
          media="image"
          upload="poster"
          items={value.gallery}
          addLabel="Add still"
          onChange={(v) => set('gallery', v)}
          hint="The detail page only shows this gallery when there is more than one."
        />
      </div>

      <Repeater
        label="Credits"
        items={value.credits}
        onChange={(v) => set('credits', v)}
        blank={(): Credit => ({ role: '', name: '' })}
        addLabel="Add credit"
        title={(item) => `${item.role}${item.name ? ` — ${item.name}` : ''}`}
        render={(item, setItem) => (
          <Row>
            <Text
              label="Role"
              value={item.role}
              onChange={(v) => setItem({ ...item, role: v })}
            />
            <Text
              label="Name"
              value={item.name}
              onChange={(v) => setItem({ ...item, name: v })}
            />
          </Row>
        )}
      />

      <Repeater
        label="Recordings"
        hint="What the player on this page plays, and what this piece contributes to its discipline’s card on the About page."
        items={value.tracks}
        onChange={(v) => set('tracks', v)}
        blank={(): Track => ({
          id: `${value.slug}-${value.tracks.length + 1}`,
          title: '',
          duration: 180,
        })}
        addLabel="Add recording"
        title={(item) => item.title || item.id || 'Untitled recording'}
        render={(item, setItem) => (
          <div className="space-y-4">
            <Row>
              <Text
                label="ID"
                mono
                value={item.id}
                onChange={(v) => setItem({ ...item, id: v })}
                hint="Unique. Also seeds this track’s waveform, so two tracks sharing one draw the same picture."
              />
              <Text
                label="Title"
                value={item.title}
                onChange={(v) => setItem({ ...item, title: v })}
              />
            </Row>
            <Row>
              <Text
                label="Composer"
                value={item.composer ?? ''}
                onChange={(v) =>
                  setItem({ ...item, composer: v || undefined })
                }
              />
              <Num
                label="Duration (seconds)"
                value={item.duration}
                onChange={(v) => setItem({ ...item, duration: v })}
                hint="Drives the scrubber until the file itself reports its length."
              />
            </Row>
            <MediaField
              label="Audio"
              kind="audio"
              value={item.audioSrc ?? ''}
              onChange={(v) => setItem({ ...item, audioSrc: v || undefined })}
              upload={{ kind: 'audio', clearable: true }}
              hint="Left empty, the player synthesises a demo tone so the interface is still testable."
            />
            <Text
              label="Liner note"
              value={item.note ?? ''}
              onChange={(v) => setItem({ ...item, note: v || undefined })}
            />
          </div>
        )}
      />
    </div>
  )
}
