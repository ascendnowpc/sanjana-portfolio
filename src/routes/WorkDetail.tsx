import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Track } from '@/types/content'
import {
  useCategoryMap,
  usePerformances,
  useUi,
} from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { fill } from '@/lib/copy'
import { VideoStage } from '@/components/media/VideoStage'
import { WaveformPlayer } from '@/components/audio/WaveformPlayer'
import { Reveal } from '@/components/ui/Reveal'
import { SplitText } from '@/components/ui/SplitText'
import { totalRuntime } from '@/lib/utils'
import { mediaUrl } from '@/lib/media'
import { EditableNumber, EditableText } from '@/components/edit/Editable'
import { MediaEdit, MediaEditButton } from '@/components/edit/EditableMedia'
import { AddItem, ItemControls, RegionEdit } from '@/components/edit/ListEdit'
import type { MediaResult } from '@/components/edit/MediaDialog'

/**
 * The soundtrack, once it has been lifted off a newly uploaded film.
 *
 * A performance keeps its audio on a `Track`, not in a field of its own, so an
 * extracted mp3 has nowhere to go until there is a track to hold it. Updating
 * the first one is right when there is one — it is the recording of this piece —
 * and when there is none, one has to be built whole rather than conjured by
 * writing a path into an empty list, which would leave a track with an audio
 * file and no id, title or length.
 */
function withExtractedAudio(
  tracks: Track[],
  result: MediaResult,
  { slug, title }: { slug: string; title: string },
): Track[] {
  if (!result.audio) return tracks
  if (tracks.length) {
    return tracks.map((t, i) =>
      i === 0
        ? { ...t, audioSrc: result.audio, duration: result.duration ?? t.duration }
        : t,
    )
  }
  return [
    {
      id: `${slug}-1`,
      title,
      duration: result.duration ?? 0,
      audioSrc: result.audio,
    },
  ]
}

export default function WorkDetail() {
  const { slug = '' } = useParams()
  const { items, loading } = usePerformances()
  const ui = useUi()
  const categoryMap = useCategoryMap()
  const { editing, commit } = useEdit()

  const { current, prev, next, index } = useMemo(() => {
    const ordered = items.slice().sort((a, b) => b.year - a.year)
    const i = ordered.findIndex((p) => p.slug === slug)
    return {
      current: i >= 0 ? ordered[i] : undefined,
      prev: i > 0 ? ordered[i - 1] : ordered[ordered.length - 1],
      next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : ordered[0],
      // Where this piece sits in the content itself. The list above is sorted
      // for the previous/next links, and an edit written at a sorted position
      // would land on whichever piece happened to be there.
      index: items.findIndex((p) => p.slug === slug),
    }
  }, [items, slug])

  if (!current) {
    // While Supabase is still resolving, hold rather than bounce to 404.
    if (loading) return <div className="min-h-screen bg-void" />
    return <Navigate to="/404" replace />
  }

  const category = categoryMap[current.category]
  const accent = current.accent ?? category?.accent ?? '#e6e6e6'
  /** Every editable field on this page hangs off here. */
  const base: (string | number)[] = ['performances', index]

  // Archive entries carry a year, a runtime and little else until the venue
  // and personnel are filled in, so every optional row drops out rather than
  // rendering an empty definition.
  /**
   * The rows beside the prose.
   *
   * A row drops out when its value is empty — archive entries carry a year, a
   * runtime and little else until the venue and personnel are filled in, and an
   * empty definition list is worse than a short one. In edit mode every row is
   * shown regardless, because a field that is hidden until it has a value is a
   * field that can never be given one from the page.
   *
   * `field` is the path the value is written back to; `derived` marks the one row
   * that is computed from the tracks rather than typed.
   */
  const meta: {
    label: string
    labelPath: (string | number)[]
    value: string
    field?: (string | number)[]
    derived?: boolean
  }[] = [
    {
      label: ui.workDetail.meta.year,
      labelPath: ['ui', 'workDetail', 'meta', 'year'],
      value: String(current.year),
      field: [...base, 'year'],
    },
    {
      label: ui.workDetail.meta.venue,
      labelPath: ['ui', 'workDetail', 'meta', 'venue'],
      value: current.venue,
      field: [...base, 'venue'],
    },
    {
      label: ui.workDetail.meta.city,
      labelPath: ['ui', 'workDetail', 'meta', 'city'],
      value: current.city,
      field: [...base, 'city'],
    },
    {
      label: ui.workDetail.meta.role,
      labelPath: ['ui', 'workDetail', 'meta', 'role'],
      value: current.role ?? '',
      field: [...base, 'role'],
    },
    {
      label: ui.workDetail.meta.runtime,
      labelPath: ['ui', 'workDetail', 'meta', 'runtime'],
      value: current.runtime ?? '',
      field: [...base, 'runtime'],
    },
    {
      label: ui.workDetail.meta.recording,
      labelPath: ['ui', 'workDetail', 'meta', 'recording'],
      value: current.tracks.length
        ? totalRuntime(current.tracks.map((t) => t.duration))
        : '',
      derived: true,
    },
  ].filter((m) => editing || Boolean(m.value))

  return (
    <article className="min-h-screen bg-void">
      {/* ---------------- title, then the film ----------------
          The piece announces itself in type before it plays. The full-bleed
          player used to open the page and the title was dragged up over its
          bottom edge, which put the name of the work on top of the work and
          left the controls fighting the <h1> for clicks. Reading order now
          matches the reference: who, what, then watch. */}
      <header className="mx-auto max-w-[1100px] px-6 pt-32 text-center md:px-12 md:pt-40">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <Link
            to={`/work?category=${current.category}`}
            className="label text-dust transition-colors duration-300 hover:text-chalk"
          >
            {category?.label} — {current.year}
          </Link>

          <h1 className="tracked mt-8 text-[clamp(1.9rem,6vw,5rem)] leading-[1.06] text-chalk">
            {/* `SplitText` gives every character its own span to animate, which
                is exactly what a caret cannot survive. In edit mode the title is
                one field instead; the entrance is not what anybody is here for
                while they are renaming the piece. */}
            {editing ? (
              <EditableText
                path={[...base, 'title']}
                value={current.title}
                placeholder="Title"
              />
            ) : (
              <SplitText text={current.title} delay={0.15} stagger={0.045} />
            )}
          </h1>

          <motion.p
            className="mx-auto mt-8 max-w-2xl text-[0.72rem] leading-[2] tracking-[0.18em] text-mist uppercase"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <EditableText
              path={[...base, 'blurb']}
              value={current.blurb}
              placeholder="One sentence about this piece"
              multiline
            />
          </motion.p>

          <motion.a
            href="#recording"
            className="mt-10 inline-flex flex-col items-center gap-2 text-dust transition-colors duration-300 hover:text-chalk"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.75 }}
          >
            <span className="text-lg leading-none">+</span>
            <span className="label">
              <EditableText
                path={['ui', 'workDetail', 'moreInfo']}
                value={ui.workDetail.moreInfo}
              />
            </span>
          </motion.a>

          {editing && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {/* The one that does the work: a film dropped here is transcoded
                  for nothing, uploaded once, and leaves behind its soundtrack,
                  its poster, its hover loop, its shape and its runtime. */}
              <MediaEditButton
                target={{
                  path: [...base, 'videoSrc'],
                  kind: 'video',
                  label: 'The recording',
                  clearable: true,
                  deriveKinds: ['audio'],
                  derive: {
                    poster: [...base, 'poster'],
                    preview: [...base, 'previewSrc'],
                    aspect: [...base, 'aspect'],
                    runtime: [...base, 'runtime'],
                  },
                  // The extracted mp3 belongs on a track, which may have to be
                  // built — see `withExtractedAudio`.
                  onResult: (result) => {
                    if (!result.audio) return
                    commit(
                      [...base, 'tracks'],
                      withExtractedAudio(current.tracks, result, {
                        slug: current.slug,
                        title: current.title,
                      }),
                    )
                  },
                }}
                label="Replace the recording"
              />
              <MediaEditButton
                target={{
                  path: [...base, 'poster'],
                  kind: 'poster',
                  label: 'Poster still',
                }}
                label="Replace the still"
              />
              <MediaEditButton
                target={{
                  path: [...base, 'previewSrc'],
                  kind: 'preview',
                  label: 'Hover loop',
                  clearable: true,
                }}
                label="Replace the hover loop"
              />
              <RegionEdit drawer="performances" label="All fields for this piece" />
            </div>
          )}
        </motion.div>
      </header>

      <motion.div
        className="mt-16 md:mt-20"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <VideoStage
          poster={current.poster}
          videoSrc={current.videoSrc}
          title={current.title}
          fallbackHref="#recording"
        />
      </motion.div>

      {/* ---------------- meta + body ---------------- */}
      <div className="relative mx-auto max-w-[1600px] px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mt-24 text-sm font-light tracking-wide text-mist">
            <EditableText
              path={[...base, 'subtitle']}
              value={current.subtitle}
              placeholder="Solo Concert — Symphony Hall"
            />
          </p>
        </motion.div>

        {/* ---------------- meta + body ---------------- */}
        <div className="mt-20 grid gap-14 border-t border-edge/50 pt-14 lg:grid-cols-[300px_1fr] lg:gap-24">
          <Reveal>
            <dl className="space-y-6">
              {meta.map((m) => (
                <div key={m.label}>
                  <dt className="label text-dust">
                    <EditableText path={m.labelPath} value={m.label} />
                  </dt>
                  <dd className="mt-2 text-sm font-light text-chalk">
                    {m.derived || !m.field ? (
                      // Added up from the tracks, so there is nothing to type
                      // here; the lengths themselves are edited in the drawer.
                      m.value || <span className="text-dust">—</span>
                    ) : m.field[m.field.length - 1] === 'year' ? (
                      <EditableNumber path={m.field} value={current.year} />
                    ) : (
                      <EditableText
                        path={m.field}
                        value={m.value}
                        placeholder={m.label}
                      />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <div>
            {(current.description || editing) && (
              <Reveal>
                <p className="max-w-2xl text-sm leading-[1.9] font-light text-mist/80">
                  <EditableText
                    path={[...base, 'description']}
                    value={current.description}
                    placeholder="The long-form note about this performance"
                    multiline
                  />
                </p>
              </Reveal>
            )}

            {/* ---------------- audio ---------------- */}
            {current.tracks.length > 0 && (
              <Reveal delay={0.1}>
                <div
                  id="recording"
                  className="mt-24 scroll-mt-32 border-t border-edge/50 pt-14"
                >
                  <WaveformPlayer
                    tracks={current.tracks}
                    accent={accent}
                    label={
                      current.venue
                        ? fill(ui.workDetail.listenAt, { venue: current.venue })
                        : ui.workDetail.listen
                    }
                  />
                </div>
              </Reveal>
            )}

            {/* ---------------- credits ---------------- */}
            {(current.credits.length > 0 || editing) && (
              <Reveal delay={0.1}>
                <div className="mt-24 border-t border-edge/50 pt-14">
                  <p className="label mb-8 text-dust">
                    <EditableText
                      path={['ui', 'workDetail', 'credits']}
                      value={ui.workDetail.credits}
                    />
                  </p>
                  <ul className="grid gap-x-12 gap-y-5 sm:grid-cols-2">
                    {current.credits.map((c, i) => (
                      <li
                        key={`${c.role}-${c.name}-${i}`}
                        className="flex items-baseline justify-between gap-6 border-b border-edge/40 pb-3"
                      >
                        <span className="text-xs tracking-wider text-dust uppercase">
                          <EditableText
                            path={[...base, 'credits', i, 'role']}
                            value={c.role}
                            placeholder="Role"
                          />
                        </span>
                        <span className="flex items-baseline gap-2 text-sm font-light text-chalk">
                          <EditableText
                            path={[...base, 'credits', i, 'name']}
                            value={c.name}
                            placeholder="Name"
                          />
                          <ItemControls
                            path={[...base, 'credits']}
                            index={i}
                            blank={() => ({ role: 'Role', name: 'Name' })}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <AddItem
                    path={[...base, 'credits']}
                    label="Add a credit"
                    className="mt-6"
                    blank={() => ({ role: 'Role', name: 'Name' })}
                  />
                </div>
              </Reveal>
            )}
          </div>
        </div>

        {/* ---------------- stills ---------------- */}
        {(current.gallery.length > 1 || editing) && (
          <Reveal>
            <div className="mt-28 border-t border-edge/50 pt-14">
              <p className="label mb-8 text-dust">
                <EditableText
                  path={['ui', 'workDetail', 'stills']}
                  value={ui.workDetail.stills}
                />
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {current.gallery.map((src, i) => (
                  <motion.div
                    key={`${src}-${i}`}
                    className="relative overflow-hidden bg-ink"
                    style={{ aspectRatio: '16 / 10' }}
                    initial={{ opacity: 0, scale: 1.04 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 1, delay: i * 0.08 }}
                  >
                    <img
                      src={mediaUrl(src)}
                      alt={fill(ui.workDetail.stillAlt, {
                        title: current.title,
                        n: i + 1,
                      })}
                      loading="lazy"
                      className="h-full w-full object-cover brightness-75 transition-all duration-1000 hover:scale-105 hover:brightness-100"
                    />
                    <MediaEdit
                      target={{
                        path: [...base, 'gallery', i],
                        kind: 'poster',
                        label: `Still ${i + 1}`,
                      }}
                      label={`Still ${i + 1}`}
                    />
                    <ItemControls
                      path={[...base, 'gallery']}
                      index={i}
                      className="absolute top-2 right-2 z-40"
                      blank={() => ''}
                    />
                  </motion.div>
                ))}
              </div>
              <AddItem
                path={[...base, 'gallery']}
                label="Add a still"
                className="mt-6"
                blank={() => ''}
              />
            </div>
          </Reveal>
        )}
      </div>

      {/* ---------------- prev / next ---------------- */}
      <nav className="mt-32 grid border-t border-edge/50 sm:grid-cols-2">
        {[
          {
            p: prev,
            dir: ui.workDetail.previous,
            dirPath: ['ui', 'workDetail', 'previous'] as (string | number)[],
            align: 'text-left',
          },
          {
            p: next,
            dir: ui.workDetail.next,
            dirPath: ['ui', 'workDetail', 'next'] as (string | number)[],
            align: 'sm:text-right',
          },
        ].map(({ p, dir, dirPath, align }) => (
          <Link
            key={dir}
            to={`/work/${p.slug}`}
            className="group relative overflow-hidden border-edge/50 px-6 py-16 transition-colors sm:not-last:border-r md:px-12"
          >
            <img
              src={mediaUrl(p.poster)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-1000 group-hover:scale-105 group-hover:opacity-25"
            />
            <span className="relative block">
              <span className="label text-dust">
                <EditableText path={dirPath} value={dir} />
              </span>
              <span
                className={`tracked-tight mt-4 block text-xl text-chalk transition-colors duration-300 group-hover:text-bloom ${align}`}
              >
                {p.title}
              </span>
            </span>
          </Link>
        ))}
      </nav>
    </article>
  )
}
