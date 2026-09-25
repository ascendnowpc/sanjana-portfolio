import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSiteContent } from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import {
  exportContent,
  hasOverrides,
  importContent,
  publishedStamp,
} from '@/lib/contentStore'
import { publishStatus, type PublishStatus } from '@/lib/publish'
import { GHOST_BTN } from '@/components/admin/fields'
import type { SiteContent } from '@/types/content'
import { AboutSection } from '@/components/admin/sections/AboutSection'
import { AccessSection } from '@/components/admin/sections/AccessSection'
import { CategoriesSection } from '@/components/admin/sections/CategoriesSection'
import { CopySection } from '@/components/admin/sections/CopySection'
import { CoversSection } from '@/components/admin/sections/CoversSection'
import { PerformancesSection } from '@/components/admin/sections/PerformancesSection'
import { ProfileSection } from '@/components/admin/sections/ProfileSection'

/**
 * The panel.
 *
 * One rule ran through this from the beginning: **everything on the site is
 * editable here.** It still holds, and there is now a second way in — the site
 * itself. Signing in here turns on an edit mode that runs on every page, where a
 * heading is the field that holds it and a film is the thing you drop a new film
 * onto (see edit/EditProvider.tsx).
 *
 * So the panel is no longer the only door, and that changes what it is *for*
 * rather than making it redundant. A form is better than a page for the things a
 * page cannot show: a hex accent, the order of thirty-six performances, an alt
 * text, which recording plays under the index, a field on a piece that has no
 * value yet and therefore nothing on screen to click. It is also simply faster
 * when the job is twelve entries rather than one word.
 *
 * Edits here are held in a draft and committed on Save rather than written as
 * they are typed — unlike the page, where the site behind the caret *is* the
 * preview and writing through is the whole point. A form has no such feedback,
 * so it keeps its escape hatch: "I have not saved yet".
 *
 * `/admin` is a private convenience rather than a page of the site, so it is
 * kept out of the sitemap, out of the navigation and out of the crawler's way.
 */

/**
 * The sections, in the order the site reads.
 *
 * Each one carries three things beyond its name. `blurb` says what is in it,
 * at the head of the section rather than in a manual nobody opens. `preview`
 * is the page these edits come out on, so "let me look at it" is one press
 * from wherever you are. `watch` picks out exactly the content the section
 * puts on screen, which is what lets the nav mark the sections holding unsaved
 * work — a tab you have not opened should never be wearing a dot.
 */
const TABS = [
  {
    id: 'profile',
    label: 'Profile',
    blurb:
      'Her name, the line under it, the portrait, and the links the site offers to reach her.',
    preview: '/',
    watch: (c: SiteContent) => [c.profile],
  },
  {
    id: 'about',
    label: 'About page',
    blurb:
      'The opening film and statement, the portrait column beside it, and the testimonial run at the foot.',
    preview: '/about',
    watch: (c: SiteContent) => [c.portrait, c.testimonials, c.ui.about],
  },
  {
    id: 'work',
    label: 'Performances',
    blurb:
      'The archive, in running order — every field of every piece, one at a time.',
    preview: '/work',
    watch: (c: SiteContent) => [c.performances],
  },
  {
    id: 'covers',
    label: 'Musical covers',
    blurb:
      'Songs she did not write. The key is hidden from visitors until there is one behind it.',
    preview: '/about',
    watch: (c: SiteContent) => [c.covers],
  },
  {
    id: 'categories',
    label: 'Disciplines',
    blurb:
      'The disciplines pieces are filed under, and the recording the index plays beneath itself.',
    preview: '/work',
    watch: (c: SiteContent) => [c.categories, c.music],
  },
  {
    id: 'copy',
    label: 'Site text',
    blurb:
      'Every word the site says that is not a performance — the navigation, the headings, the buttons, the browser tab.',
    preview: '/',
    watch: (c: SiteContent) => [c.ui],
  },
  {
    id: 'access',
    label: 'Access & data',
    blurb:
      'The panel password, what is published and what is only in this browser, and the way out to a JSON file.',
    preview: '/',
    watch: (c: SiteContent) => [c.admin],
  },
] as const

type TabId = (typeof TABS)[number]['id']

export default function Admin() {
  const live = useSiteContent()
  const { signedIn, signIn } = useEdit()

  // Crawlers are told to leave this alone. It is not protection — see the
  // Access tab for what the password is and is not worth — it is only there so
  // an unlisted page does not end up in a search result.
  useEffect(() => {
    const tag = document.createElement('meta')
    tag.name = 'robots'
    tag.content = 'noindex, nofollow'
    document.head.appendChild(tag)
    return () => {
      tag.remove()
    }
  }, [])

  if (!signedIn) return <Login onSubmit={signIn} />

  return <Panel live={live} />
}

/* ============================== the door ============================== */

function Login({ onSubmit }: { onSubmit: (password: string) => boolean }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // The session owns the check and the flag, so signing in here also turns on
    // editing everywhere else. It used to be this route's own state, which meant
    // the door only opened onto the form behind it.
    if (onSubmit(value)) return
    setError(true)
    setValue('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="label mb-6 text-bloom">Admin</p>
        <h1 className="tracked text-[clamp(1.4rem,4vw,2.2rem)] text-chalk">
          Sign in
        </h1>
        <p className="mt-4 text-sm leading-relaxed font-light text-mist">
          Everything on the site is edited from behind this door — the words, the
          photographs, the archive and the links. From here, or from the pages
          themselves.
        </p>

        <div className="mt-10">
          <label htmlFor="admin-password" className="label mb-3 block text-dust">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(false)
            }}
            className="w-full border-0 border-b border-edge bg-transparent pb-3 text-sm font-light text-chalk transition-colors focus:border-bloom focus:outline-none"
          />
          {/* Announced, not just coloured: somebody using a screen reader gets
              the same "that was wrong" the sighted visitor does. */}
          <p
            role="status"
            className={`mt-4 text-xs transition-opacity duration-300 ${
              error ? 'text-red-400 opacity-100' : 'opacity-0'
            }`}
          >
            {error ? 'That password is not right.' : ' '}
          </p>
        </div>

        <button
          type="submit"
          className="mt-8 w-full border border-edge px-10 py-4 text-[0.62rem] tracking-[0.34em] text-chalk uppercase transition-all duration-500 hover:border-bloom hover:bg-bloom hover:text-void"
        >
          Enter
        </button>

        <Link
          to="/"
          className="label mt-10 block text-center text-dust transition-colors hover:text-chalk"
        >
          Back to the site
        </Link>
      </form>
    </div>
  )
}

/* ============================== the panel ============================== */

function Panel({ live }: { live: SiteContent }) {
  const navigate = useNavigate()
  const {
    replace,
    discard,
    publish,
    publishing,
    signOut,
    setEditing,
    dirty,
    note: sessionNote,
  } = useEdit()

  const [tab, setTab] = useState<TabId>('profile')
  /**
   * The working copy.
   *
   * Seeded once, deliberately. Re-seeding it whenever `live` changed would undo
   * the editor's own keystrokes, since saving is what changes `live` — and now
   * that the same content can be edited on the page, `live` moves for reasons
   * this form knows nothing about.
   */
  const [draft, setDraft] = useState<SiteContent>(() => structuredClone(live))
  const [localDirty, setLocalDirty] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(
    null,
  )
  const [status, setStatus] = useState<PublishStatus | null>(null)

  useEffect(() => {
    void publishStatus().then(setStatus)
  }, [])

  /** Write one top-level slice, which is what every section hands back. */
  const put = useCallback(
    <K extends keyof SiteContent>(key: K) =>
      (value: SiteContent[K]) =>
        setDraft((prev) => {
          setLocalDirty(true)
          setNote(null)
          return { ...prev, [key]: value }
        }),
    [],
  )

  const save = () => {
    replace(draft)
    setLocalDirty(false)
    setNote({
      tone: 'ok',
      text: 'Saved. The site is showing your changes — publish to make them live for everybody.',
    })
  }

  const revert = () => {
    if (
      !confirm(
        'Throw away every change typed into this form since the last save?',
      )
    ) {
      return
    }
    setDraft(structuredClone(live))
    setLocalDirty(false)
    setNote({ tone: 'ok', text: 'Unsaved changes discarded.' })
  }

  /**
   * Publish what is in the *form*, not what the store is showing.
   *
   * Saving first is not a convenience here, it is the only correct order: the
   * endpoint commits the composed content, and a publish that skipped the save
   * would commit the site as it was before the last thing typed into this form.
   */
  const publishNow = async () => {
    if (localDirty) replace(draft)
    const result = await publish('Content: publish edits made in the panel')
    if (result.ok) setLocalDirty(false)
  }

  // The browser's own guard, for the form's unsaved draft. The session keeps its
  // own for unpublished edits; this one is about the boxes on this screen.
  useEffect(() => {
    if (!localDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [localDirty])

  const download = () => {
    const blob = new Blob([exportContent()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sanjana-content-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const houseSlugs = useMemo(
    () =>
      draft.performances.map((p) => ({
        value: p.slug,
        label: `${p.title} (${p.year})`,
      })),
    [draft.performances],
  )

  /**
   * Which sections are carrying unsaved work, so the nav can mark them.
   *
   * Compared against `live` rather than against a snapshot taken when the form
   * opened, because `live` is what Save writes to and what editing on the page
   * writes to as well. Two sections both showing `ui.about` both light up,
   * which is the honest answer: the change really is on both screens.
   */
  const dirtyTabs = useMemo(() => {
    if (!localDirty) return new Set<TabId>()
    const out = new Set<TabId>()
    for (const t of TABS) {
      if (JSON.stringify(t.watch(draft)) !== JSON.stringify(t.watch(live))) {
        out.add(t.id)
      }
    }
    return out
  }, [draft, live, localDirty])

  const current = TABS.find((t) => t.id === tab)!

  // ⌘S / Ctrl-S. A form this long is scrolled away from its own buttons most
  // of the time, and the browser's own Save does nothing useful here anyway.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (localDirty) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const shown = note ?? sessionNote
  const stamp = publishedStamp()

  return (
    <div className="min-h-screen bg-neutral-950 pb-40 text-neutral-200">
      {/* ---------------- bar ----------------
          Identity and the ways out. What *changes* the content — Save, Discard,
          Publish — is at the foot of the screen instead, where it is in reach
          from the middle of a long section rather than a scroll away at the
          top. */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 md:px-8">
          <div className="mr-auto">
            <p className="text-sm text-white">
              {draft.profile.name} — admin
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {localDirty
                ? 'Unsaved changes in this form'
                : dirty
                  ? 'Saved here, not yet published'
                  : 'Everything published'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Link
              to={current.preview}
              target="_blank"
              className={`${GHOST_BTN} px-3 py-2`}
              title={`Open ${current.preview} in a new tab`}
            >
              View page ↗
            </Link>
            <button
              type="button"
              onClick={() => {
                // Straight into edit mode on the page, which is the other half
                // of this screen rather than a different tool.
                setEditing(true)
                navigate(current.preview)
              }}
              className={`${GHOST_BTN} px-3 py-2`}
            >
              Edit on the page
            </button>
            <button
              type="button"
              onClick={signOut}
              className={`${GHOST_BTN} px-3 py-2`}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- body ----------------
          A div, not a <main>: the app already wraps every route in one, and a
          page may only have the one. */}
      <div className="mx-auto grid max-w-[1400px] gap-8 px-5 pt-8 md:px-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* The seven sections, all of them visible at once rather than
            scrolling out of a strip, each marked when it is holding work that
            has not been saved. */}
        <nav className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {TABS.map((t) => {
              const here = t.id === tab
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-current={here ? 'page' : undefined}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors ${
                      here
                        ? 'bg-white/10 text-white'
                        : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                    }`}
                  >
                    <span className="flex-1">{t.label}</span>
                    {dirtyTabs.has(t.id) && (
                      <span
                        title="Unsaved changes"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <div className="mb-6">
            <h1 className="text-xl text-white">{current.label}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-500">
              {current.blurb}
            </p>
          </div>

        {tab === 'profile' && (
          <ProfileSection value={draft.profile} onChange={put('profile')} />
        )}

        {tab === 'about' && (
          <AboutSection
            portrait={draft.portrait}
            onPortraitChange={put('portrait')}
            testimonials={draft.testimonials}
            onTestimonialsChange={put('testimonials')}
            ui={draft.ui}
            onUiChange={put('ui')}
          />
        )}

        {tab === 'work' && (
          <PerformancesSection
            items={draft.performances}
            onChange={put('performances')}
            categories={draft.categories}
          />
        )}

        {tab === 'covers' && (
          <CoversSection value={draft.covers} onChange={put('covers')} />
        )}

        {tab === 'categories' && (
          <CategoriesSection
            categories={draft.categories}
            onCategoriesChange={put('categories')}
            music={draft.music}
            onMusicChange={put('music')}
            houseSlugs={houseSlugs}
          />
        )}

        {tab === 'copy' && <CopySection value={draft.ui} onChange={put('ui')} />}

        {tab === 'access' && (
          <AccessSection
            value={draft.admin}
            onChange={put('admin')}
            hasLocalEdits={hasOverrides()}
            publishedAt={stamp}
            publishStatus={status}
            onExport={download}
            onReset={() => {
              discard()
              // The store now holds the published content; the draft has to
              // follow it or the next Save would put the discarded edits back.
              setDraft(structuredClone(live))
              setLocalDirty(false)
              setNote({ tone: 'ok', text: 'Reset to the published content.' })
            }}
            onImport={(json) => {
              const result = importContent(json)
              if (!result.ok) {
                setNote({ tone: 'bad', text: result.error ?? 'Import failed.' })
                return
              }
              setLocalDirty(false)
              setNote({ tone: 'ok', text: 'Imported and saved.' })
            }}
          />
        )}

          {/* ---------------- save bar ----------------
              Sticks to the foot of the screen so it is reachable from the
              middle of a section rather than only from the top of one, and so
              the answer to "have I saved this?" is always on screen. */}
          <div className="sticky bottom-4 z-20 mt-8 flex flex-wrap items-center gap-2 rounded-sm border border-white/12 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={save}
              disabled={!localDirty}
              className="cursor-pointer rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={revert}
              disabled={!localDirty}
              className={`${GHOST_BTN} px-3 py-2`}
            >
              Discard
            </button>

            <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />

            <button
              type="button"
              onClick={() => {
                void publishNow()
              }}
              disabled={
                (!dirty && !localDirty) ||
                publishing ||
                (status ? !status.configured : false)
              }
              title={
                status && !status.configured
                  ? (status.unavailable ??
                    `Publishing needs ${status.missing.join(', ')} set on the deployment — see EDITING.md.`)
                  : 'Commit the content to the repository and rebuild the site'
              }
              className="cursor-pointer rounded-sm border border-white/25 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>

            {/* The one line that says which of the three states an edit is in.
                Announced, so it is not only a colour. */}
            <p
              role="status"
              className={`ml-auto max-w-lg text-xs leading-relaxed ${
                shown?.tone === 'bad'
                  ? 'text-red-400'
                  : shown?.tone === 'ok'
                    ? 'text-emerald-400'
                    : shown
                      ? 'text-sky-300'
                      : 'text-neutral-500'
              }`}
            >
              {shown
                ? shown.text
                : localDirty
                  ? 'Unsaved changes — Save keeps them in this browser, Publish puts them on the site.'
                  : dirty
                    ? 'Saved in this browser. Publish to put it on the site for everybody — about a minute.'
                    : 'Everything here is published.'}
            </p>
          </div>

          {status && !status.configured && (
            <p className="mt-6 text-xs leading-relaxed text-neutral-600">
              Publishing is not set up on this deployment yet; until it is, use
              Export JSON on the Access &amp; data tab. EDITING.md has the
              setup.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
