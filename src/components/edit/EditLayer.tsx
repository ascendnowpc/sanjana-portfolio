import { lazy, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useSiteContent } from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { publishedStamp } from '@/lib/contentStore'
import { publishStatus, type PublishStatus } from '@/lib/publish'

/**
 * The editor's own chrome: one bar, and a drawer behind it.
 *
 * Loaded only for somebody who has signed in — App imports this lazily, so a
 * visitor downloads none of it, and neither do the panel's form sections that
 * the drawer pulls in behind that.
 *
 * The bar is the answer to a question inline editing raises and cannot answer by
 * itself: *what is the state of what I am looking at?* A page in edit mode shows
 * the content, not where the content came from — so the bar says whether these
 * are the published words or this browser's unpublished draft, and puts the four
 * things that change that answer in one place.
 */

/**
 * The panel's sections, behind the drawer.
 *
 * Lazy, each of them: the copy section alone is a thousand lines of form, and
 * an editor who only ever fixes a typo in a heading should never fetch it.
 */
const SECTIONS = {
  profile: lazy(async () => ({
    default: (await import('@/components/admin/sections/ProfileSection')).ProfileSection,
  })),
  about: lazy(async () => ({
    default: (await import('@/components/admin/sections/AboutSection')).AboutSection,
  })),
  performances: lazy(async () => ({
    default: (await import('@/components/admin/sections/PerformancesSection')).PerformancesSection,
  })),
  categories: lazy(async () => ({
    default: (await import('@/components/admin/sections/CategoriesSection')).CategoriesSection,
  })),
  covers: lazy(async () => ({
    default: (await import('@/components/admin/sections/CoversSection')).CoversSection,
  })),
  copy: lazy(async () => ({
    default: (await import('@/components/admin/sections/CopySection')).CopySection,
  })),
} as const

type SectionId = keyof typeof SECTIONS

const SECTION_TITLES: Record<SectionId, string> = {
  profile: 'Profile, contact & links',
  about: 'About page',
  performances: 'The archive',
  categories: 'Disciplines & the shelf',
  covers: 'Musical covers',
  copy: 'Every fixed word on the site',
}

export default function EditLayer() {
  return (
    <>
      <EditBar />
      <EditDrawer />
    </>
  )
}

/* ================================= bar ================================= */

function EditBar() {
  const {
    editing,
    setEditing,
    dirty,
    note,
    publishing,
    publish,
    discard,
    save,
    signOut,
  } = useEdit()
  const [status, setStatus] = useState<PublishStatus | null>(null)
  const [minimised, setMinimised] = useState(false)

  useEffect(() => {
    void publishStatus().then(setStatus)
  }, [])

  const stamp = publishedStamp()

  if (minimised) {
    return createPortal(
      <button
        type="button"
        onClick={() => setMinimised(false)}
        className="edit-chrome fixed right-4 bottom-4 rounded-full border border-sky-300/60 bg-slate-950/90 px-4 py-2 text-[0.6rem] tracking-[0.2em] text-sky-100 uppercase shadow-xl backdrop-blur-md"
      >
        {editing ? 'Editing' : 'Admin'}
        {dirty && <span className="ml-2 text-amber-300">•</span>}
      </button>,
      document.body,
    )
  }

  return createPortal(
    <div className="edit-chrome pointer-events-none fixed inset-x-0 bottom-0 flex justify-center p-3 sm:p-4">
      <div className="pointer-events-auto w-full max-w-[1100px] rounded-sm border border-white/12 bg-neutral-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-md sm:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* --------- the switch --------- */}
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            aria-pressed={editing}
            className={`shrink-0 rounded-sm border px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition-colors ${
              editing
                ? 'border-sky-400 bg-sky-400 text-slate-950'
                : 'border-white/20 text-neutral-300 hover:border-white/50 hover:text-white'
            }`}
          >
            {editing ? 'Editing on' : 'Edit this page'}
          </button>

          {/* --------- where things stand --------- */}
          <div className="mr-auto min-w-0">
            <p className="truncate text-[0.68rem] text-neutral-400">
              {note ? (
                <span
                  role="status"
                  className={
                    note.tone === 'ok'
                      ? 'text-emerald-400'
                      : note.tone === 'bad'
                        ? 'text-red-400'
                        : 'text-sky-300'
                  }
                >
                  {note.text}
                </span>
              ) : dirty ? (
                <span className="text-amber-300">
                  Unpublished edits, in this browser only
                </span>
              ) : (
                <span>
                  Showing the published site
                  {stamp ? ` — last published ${friendlyDate(stamp)}` : ''}
                </span>
              )}
            </p>
            {editing && !note && (
              <p className="truncate text-[0.62rem] text-neutral-600">
                Click any word to change it. Hover a picture or a film to replace
                it. Escape leaves edit mode.
              </p>
            )}
          </div>

          {/* --------- what to do about it --------- */}
          <div className="flex flex-wrap items-center gap-2">
            <Bar onClick={save} disabled={!dirty}>
              Save
            </Bar>
            <Bar onClick={discard} disabled={!dirty} danger>
              Discard
            </Bar>
            <button
              type="button"
              onClick={() => {
                void publish()
              }}
              disabled={!dirty || publishing || (status ? !status.configured : false)}
              title={
                status && !status.configured
                  ? status.unavailable ??
                    `Publishing needs ${status.missing.join(', ')} set on the deployment — see EDITING.md.`
                  : 'Commit these edits to the repository and rebuild the site'
              }
              className="rounded-sm border border-white bg-white px-3 py-2 text-[0.6rem] tracking-[0.2em] text-black uppercase transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
            <Link
              to="/admin"
              className="rounded-sm border border-white/20 px-3 py-2 text-[0.6rem] tracking-[0.2em] text-neutral-300 uppercase transition-colors hover:border-white/50 hover:text-white"
            >
              Panel
            </Link>
            <Bar onClick={signOut}>Sign out</Bar>
            <button
              type="button"
              onClick={() => setMinimised(true)}
              aria-label="Minimise the editing bar"
              title="Minimise"
              className="grid h-8 w-8 place-items-center rounded-sm border border-white/20 text-neutral-400 transition-colors hover:border-white/50 hover:text-white"
            >
              —
            </button>
          </div>
        </div>

        {/* The one thing worth saying unprompted: this deployment cannot
            publish, so an edit made here stays here. Better said before the
            editor spends an afternoon on it than after. */}
        {status && !status.configured && (
          <p className="mt-2 border-t border-white/10 pt-2 text-[0.62rem] leading-relaxed text-amber-200/80">
            {status.unavailable ?? (
              <>
                Publishing is not set up on this deployment
                {status.missing.length ? ` (missing ${status.missing.join(', ')})` : ''}.
              </>
            )}{' '}
            Edits are saved in this browser; the panel’s Access tab can export
            them as JSON. EDITING.md has the five minutes of setup.
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Bar({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-sm border border-white/20 px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'text-neutral-300 hover:border-red-500/60 hover:text-red-400'
          : 'text-neutral-300 hover:border-white/50 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/** "24 September" or "24 September 2025", depending on whether it is this year. */
function friendlyDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'recently'
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/* ================================ drawer ================================ */

/**
 * The panel, in a sheet beside the page.
 *
 * Inline editing covers the words and the pictures. It cannot cover a hex
 * accent, the order of six disciplines, an alt text, or which recording plays
 * under the index — fields with no visible word to click. Rather than invent a
 * second kind of inline control for each, the drawer opens the panel section
 * that already edits them, against the same live content, so the page keeps
 * updating behind it as they change.
 */
function EditDrawer() {
  const content = useSiteContent()
  const { drawer, openDrawer, replace } = useEdit()

  useEffect(() => {
    // The sheet is a scroll container of its own; the page behind it must not
    // scroll with the wheel while it is open.
    if (!drawer) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawer])

  if (!drawer || !(drawer in SECTIONS)) return null
  const id = drawer as SectionId

  /** Write one top-level slice, which is what every section hands back. */
  const put =
    <K extends keyof typeof content>(key: K) =>
    (value: (typeof content)[K]) =>
      replace({ ...content, [key]: value })

  return createPortal(
    <div
      className="edit-chrome fixed inset-0 flex justify-end bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={SECTION_TITLES[id]}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) openDrawer(null)
      }}
    >
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-white/12 bg-neutral-950 text-neutral-200 shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[0.6rem] tracking-[0.28em] text-neutral-500 uppercase">
              Panel
            </p>
            <h2 className="mt-1 text-sm tracking-[0.12em] text-white uppercase">
              {SECTION_TITLES[id]}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => openDrawer(null)}
            className="rounded-sm border border-white/15 px-3 py-1.5 text-[0.6rem] tracking-[0.2em] text-neutral-300 uppercase transition-colors hover:border-white/45 hover:text-white"
          >
            Close
          </button>
        </header>

        {/* pb-28 keeps the last field clear of the editing bar, which is fixed
            over the bottom of the viewport and would otherwise cover it. */}
        <div className="flex-1 overflow-y-auto px-5 py-6 pb-28">
          <Suspense
            fallback={<p className="text-xs text-neutral-500">Loading the fields…</p>}
          >
            {id === 'profile' && (
              <SECTIONS.profile value={content.profile} onChange={put('profile')} />
            )}
            {id === 'about' && (
              <SECTIONS.about
                portrait={content.portrait}
                onPortraitChange={put('portrait')}
                testimonials={content.testimonials}
                onTestimonialsChange={put('testimonials')}
                ui={content.ui}
                onUiChange={put('ui')}
              />
            )}
            {id === 'performances' && (
              <SECTIONS.performances
                items={content.performances}
                onChange={put('performances')}
                categories={content.categories}
              />
            )}
            {id === 'categories' && (
              <SECTIONS.categories
                categories={content.categories}
                onCategoriesChange={put('categories')}
                music={content.music}
                onMusicChange={put('music')}
                houseSlugs={content.performances.map((p) => ({
                  value: p.slug,
                  label: `${p.title} (${p.year})`,
                }))}
              />
            )}
            {id === 'covers' && (
              <SECTIONS.covers value={content.covers} onChange={put('covers')} />
            )}
            {id === 'copy' && (
              <SECTIONS.copy value={content.ui} onChange={put('ui')} />
            )}
          </Suspense>
        </div>
      </div>
    </div>,
    document.body,
  )
}
