import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiteContent } from '@/content/ContentProvider'
import {
  exportContent,
  hasOverrides,
  importContent,
  resetContent,
  saveContent,
} from '@/lib/contentStore'
import type { SiteContent } from '@/types/content'
import { AboutSection } from '@/components/admin/sections/AboutSection'
import { AccessSection } from '@/components/admin/sections/AccessSection'
import { CategoriesSection } from '@/components/admin/sections/CategoriesSection'
import { CopySection } from '@/components/admin/sections/CopySection'
import { PerformancesSection } from '@/components/admin/sections/PerformancesSection'
import { ProfileSection } from '@/components/admin/sections/ProfileSection'

/**
 * The panel.
 *
 * One rule runs through the whole thing: **nothing on the site is editable
 * anywhere but here, and everything on the site is editable here.** The second
 * half is the harder one to hold, and it is why the Copy tab exists at all —
 * a "content" panel that edits the biography but not the word "Testimonials"
 * above the quotes is a panel that still needs a developer.
 *
 * Edits are held in a draft and committed on Save rather than written as they
 * are typed. A panel that writes through is a panel with no way out of a
 * mistake: there is no undo on a site's content, so the escape hatch has to be
 * "I have not saved yet". Leaving with unsaved work is confirmed, for the same
 * reason.
 *
 * `/admin` is a private convenience rather than a page of the site, so it is
 * kept out of the sitemap, out of the navigation and out of the crawler's way.
 */

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'about', label: 'About page' },
  { id: 'work', label: 'Performances' },
  { id: 'categories', label: 'Disciplines' },
  { id: 'copy', label: 'Site text' },
  { id: 'access', label: 'Access & data' },
] as const

type TabId = (typeof TABS)[number]['id']

/** Remembered for the session only — a closed browser asks again. */
const UNLOCKED_KEY = 'sanjana.admin-unlocked'

export default function Admin() {
  const live = useSiteContent()
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(UNLOCKED_KEY) === '1'
    } catch {
      return false
    }
  })

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

  if (!unlocked) {
    return (
      <Login
        expected={live.admin.password}
        onUnlock={() => {
          try {
            sessionStorage.setItem(UNLOCKED_KEY, '1')
          } catch {
            /* the session simply will not be remembered */
          }
          setUnlocked(true)
        }}
      />
    )
  }

  return (
    <Panel
      live={live}
      onLock={() => {
        try {
          sessionStorage.removeItem(UNLOCKED_KEY)
        } catch {
          /* nothing to clear */
        }
        setUnlocked(false)
      }}
    />
  )
}

/* ============================== the door ============================== */

function Login({
  expected,
  onUnlock,
}: {
  expected: string
  onUnlock: () => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value === expected) {
      onUnlock()
      return
    }
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
          Everything on the site is edited from behind this door — the words,
          the photographs, the archive and the links.
        </p>

        <div className="mt-10">
          <label
            htmlFor="admin-password"
            className="label mb-3 block text-dust"
          >
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
            {error ? 'That password is not right.' : ' '}
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

function Panel({
  live,
  onLock,
}: {
  live: SiteContent
  onLock: () => void
}) {
  const [tab, setTab] = useState<TabId>('profile')
  /**
   * The working copy.
   *
   * Seeded once, deliberately. Re-seeding it whenever `live` changed would
   * undo the editor's own keystrokes, since saving is what changes `live`.
   */
  const [draft, setDraft] = useState<SiteContent>(() => structuredClone(live))
  const [dirty, setDirty] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(
    null,
  )

  /** Write one top-level slice, which is what every section hands back. */
  const put = useCallback(
    <K extends keyof SiteContent>(key: K) =>
      (value: SiteContent[K]) =>
        setDraft((prev) => {
          setDirty(true)
          setNote(null)
          return { ...prev, [key]: value }
        }),
    [],
  )

  const save = () => {
    const result = saveContent(draft)
    setDirty(false)
    setNote(
      result.ok
        ? { tone: 'ok', text: 'Saved. The site is showing your changes.' }
        : { tone: 'bad', text: result.error ?? 'Could not save.' },
    )
  }

  const discard = () => {
    setDraft(structuredClone(live))
    setDirty(false)
    setNote({ tone: 'ok', text: 'Unsaved changes discarded.' })
  }

  // The browser's own guard. It is the only thing that can catch a closed tab
  // or a typed URL, which is most of the ways somebody leaves a page.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

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

  return (
    <div className="min-h-screen bg-neutral-950 pb-32 text-neutral-200">
      {/* ---------------- bar ---------------- */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 md:px-8">
          <div className="mr-auto">
            <p className="text-[0.62rem] tracking-[0.3em] text-neutral-500 uppercase">
              {draft.profile.name} — admin
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </p>
          </div>

          {note && (
            <p
              role="status"
              className={`text-xs ${
                note.tone === 'ok' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {note.text}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={!dirty}
              className="rounded-sm border border-white/15 px-3 py-2 text-[0.62rem] tracking-[0.18em] text-neutral-300 uppercase transition-colors hover:border-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="rounded-sm border border-white bg-white px-4 py-2 text-[0.62rem] tracking-[0.18em] text-black uppercase transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Save
            </button>
            <Link
              to="/"
              className="rounded-sm border border-white/15 px-3 py-2 text-[0.62rem] tracking-[0.18em] text-neutral-300 uppercase transition-colors hover:border-white/45 hover:text-white"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={onLock}
              className="rounded-sm border border-white/15 px-3 py-2 text-[0.62rem] tracking-[0.18em] text-neutral-300 uppercase transition-colors hover:border-white/45 hover:text-white"
            >
              Lock
            </button>
          </div>
        </div>

        {/* ---------------- tabs ---------------- */}
        <nav className="mx-auto max-w-[1400px] px-5 md:px-8">
          <div className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`shrink-0 border-b-2 px-4 py-3 text-[0.68rem] tracking-[0.16em] uppercase transition-colors ${
                  tab === t.id
                    ? 'border-white text-white'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* ---------------- body ----------------
          A div, not a <main>: the app already wraps every route in one, and a
          page may only have the one. */}
      <div className="mx-auto max-w-[1400px] px-5 pt-8 md:px-8">
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

        {tab === 'categories' && (
          <CategoriesSection
            categories={draft.categories}
            onCategoriesChange={put('categories')}
            music={draft.music}
            onMusicChange={put('music')}
            houseSlugs={houseSlugs}
          />
        )}

        {tab === 'copy' && (
          <CopySection value={draft.ui} onChange={put('ui')} />
        )}

        {tab === 'access' && (
          <AccessSection
            value={draft.admin}
            onChange={put('admin')}
            hasLocalEdits={hasOverrides()}
            onExport={download}
            onReset={() => {
              resetContent()
              // The store now holds the shipped defaults; the draft has to
              // follow it or the next Save would put the discarded edits back.
              setDraft(structuredClone(live))
              setDirty(false)
              setNote({ tone: 'ok', text: 'Reset to the deployed content.' })
            }}
            onImport={(json) => {
              const result = importContent(json)
              if (!result.ok) {
                setNote({ tone: 'bad', text: result.error ?? 'Import failed.' })
                return
              }
              setDirty(false)
              setNote({ tone: 'ok', text: 'Imported and saved.' })
            }}
          />
        )}
      </div>

      {/* One quiet line at the foot, because it is the fact that decides what
          somebody should do with their work when they are done here. */}
      <p className="mx-auto mt-16 max-w-[1400px] px-5 text-xs leading-relaxed text-neutral-600 md:px-8">
        Changes are saved in this browser only. Use{' '}
        <strong className="font-normal text-neutral-400">Export JSON</strong> on
        the Access &amp; data tab to hand them to whoever deploys the site.
      </p>
    </div>
  )
}
