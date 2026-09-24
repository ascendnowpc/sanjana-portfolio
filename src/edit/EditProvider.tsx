import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { SiteContent } from '@/types/content'
import { useSiteContent } from '@/content/ContentProvider'
import {
  applyDraft,
  getAtPath,
  getContent,
  hasOverrides,
  persistDraft,
  resetContent,
  setAtPath,
  type ContentPath,
} from '@/lib/contentStore'
import { publishContent, type PublishResult } from '@/lib/publish'

/**
 * Signing in, and editing in place.
 *
 * The panel at /admin is a form over the content. This is the other half: the
 * site itself as the form. Sign in once — at /admin, or from the footer's admin
 * key — and every page carries an edit mode. Turn it on and the words on the
 * page become the fields that hold them: the heading you are reading is the
 * input you type the new heading into, the film is the thing you drop the new
 * film onto.
 *
 * Both halves write through the same store, so they are never two answers.
 * An edit made in the page is visible in the panel and the other way round.
 *
 * ### Why the unlock lives here and not in the Admin route
 *
 * It used to live in the route, in a `useState` the route owned, because the
 * route was the only thing that cared. Editing in the page means the footer,
 * the nav, every heading and the publish bar all care, so it has to be above
 * them — and it has to survive a navigation, which route state does not.
 *
 * ### What the latch is worth
 *
 * The password is checked in the browser against a value that ships in the
 * bundle, so it decides who is *shown* the editing UI and nothing more. What
 * it cannot do is change the site for anybody else: publishing goes through a
 * function that checks the password again on the server, and the token that
 * can write to the repository is never in the page. See api/publish.ts.
 */

/** Remembered for the session only — a closed browser asks again. */
const UNLOCKED_KEY = 'sanjana.admin-unlocked'
/** Whether edit mode was on, so a navigation does not switch it off. */
const EDITING_KEY = 'sanjana.admin-editing'

type Note = { tone: 'ok' | 'bad' | 'busy'; text: string } | null

interface EditSession {
  /** Signed in. The editing UI is available; nothing is editable yet. */
  signedIn: boolean
  /** Signed in *and* edit mode is on. What every editable field checks. */
  editing: boolean
  /** True when this browser holds edits the deploy does not have. */
  dirty: boolean
  note: Note
  publishing: boolean

  signIn: (password: string) => boolean
  signOut: () => void
  setEditing: (on: boolean) => void

  /** Write one field, live, without persisting. For a keystroke. */
  set: (path: ContentPath, value: unknown) => void
  /** Write one field and remember it. For a field that has just been left. */
  commit: (path: ContentPath, value: unknown) => void
  /** Read one field out of the live content. */
  read: (path: ContentPath) => unknown
  /** Replace the whole object — what the panel's sections hand back. */
  replace: (next: SiteContent) => void
  /** Write the live draft to this browser's storage. */
  save: () => void
  /** Throw this browser's edits away. */
  discard: () => void
  /** Commit the live content into the repository. */
  publish: (message?: string) => Promise<PublishResult>
  say: (note: Note) => void

  /** Which page region has its panel drawer open, if any. */
  drawer: string | null
  openDrawer: (id: string | null) => void
}

const noop = () => {}

const EditContext = createContext<EditSession>({
  signedIn: false,
  editing: false,
  dirty: false,
  note: null,
  publishing: false,
  signIn: () => false,
  signOut: noop,
  setEditing: noop,
  set: noop,
  commit: noop,
  read: () => undefined,
  replace: noop,
  save: noop,
  discard: noop,
  publish: async () => ({ ok: false, error: 'No editing session.' }),
  say: noop,
  drawer: null,
  openDrawer: noop,
})

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) sessionStorage.setItem(key, '1')
    else sessionStorage.removeItem(key)
  } catch {
    /* the session simply will not be remembered */
  }
}

export function EditProvider({ children }: { children: ReactNode }) {
  const content = useSiteContent()
  const [signedIn, setSignedIn] = useState(() => readFlag(UNLOCKED_KEY))
  const [editing, setEditingState] = useState(
    () => readFlag(UNLOCKED_KEY) && readFlag(EDITING_KEY),
  )
  const [dirty, setDirty] = useState(() => hasOverrides())
  const [note, setNote] = useState<Note>(null)
  const [publishing, setPublishing] = useState(false)
  const [drawer, setDrawer] = useState<string | null>(null)

  /**
   * The password to check against.
   *
   * Read from the live content rather than captured, so changing it in the
   * panel takes effect at the next sign-in without a reload — and read through
   * a ref so `signIn` does not have to be rebuilt on every content change.
   */
  const passwordRef = useRef(content.admin.password)
  passwordRef.current = content.admin.password

  const signIn = useCallback((password: string) => {
    if (password !== passwordRef.current) return false
    writeFlag(UNLOCKED_KEY, true)
    setSignedIn(true)
    return true
  }, [])

  const signOut = useCallback(() => {
    writeFlag(UNLOCKED_KEY, false)
    writeFlag(EDITING_KEY, false)
    setSignedIn(false)
    setEditingState(false)
    setDrawer(null)
  }, [])

  const setEditing = useCallback((on: boolean) => {
    writeFlag(EDITING_KEY, on)
    setEditingState(on)
    if (!on) setDrawer(null)
  }, [])

  /* ------------------------------- editing ------------------------------- */

  const set = useCallback((path: ContentPath, value: unknown) => {
    setAtPath(path, value)
    setDirty(true)
    setNote(null)
  }, [])

  /**
   * A finished edit.
   *
   * Live *and* written down, because "I typed it and navigated away" has to
   * survive the navigation. Persisting per keystroke instead would serialise
   * the whole content object on every letter, so the two are separate calls
   * and the fields decide which they are making.
   */
  const commit = useCallback((path: ContentPath, value: unknown) => {
    setAtPath(path, value)
    setDirty(true)
    setNote(null)
    persistDraft()
  }, [])

  const read = useCallback((path: ContentPath) => getAtPath(path), [])

  /**
   * Persisting, but not on every keystroke.
   *
   * The drawer holds the panel's own form controls, which are ordinary React
   * inputs writing a whole content object per character. Serialising two hundred
   * kilobytes of JSON on each one is work nobody asked for, and the thing it
   * protects against — a closed tab — is not measured in milliseconds.
   */
  const persistTimer = useRef<number | null>(null)
  const schedulePersist = useCallback(() => {
    if (persistTimer.current !== null) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null
      persistDraft()
    }, 600)
  }, [])

  // A pending write must not be lost to a navigation away from the editor.
  useEffect(
    () => () => {
      if (persistTimer.current !== null) {
        window.clearTimeout(persistTimer.current)
        persistDraft()
      }
    },
    [],
  )

  const replace = useCallback(
    (next: SiteContent) => {
      applyDraft(next)
      setDirty(true)
      setNote(null)
      schedulePersist()
    },
    [schedulePersist],
  )

  const save = useCallback(() => {
    const result = persistDraft()
    setNote(
      result.ok
        ? { tone: 'ok', text: 'Saved in this browser. Publish to make it live.' }
        : { tone: 'bad', text: result.error ?? 'Could not save.' },
    )
  }, [])

  const discard = useCallback(() => {
    resetContent()
    setDirty(false)
    setNote({ tone: 'ok', text: 'Back to the published content.' })
  }, [])

  const publish = useCallback(async (message?: string) => {
    setPublishing(true)
    setNote({ tone: 'busy', text: 'Publishing…' })
    try {
      const result = await publishContent(getContent(), {
        password: passwordRef.current,
        message,
      })
      if (result.ok) {
        setDirty(false)
        setNote({
          tone: 'ok',
          text: 'Published. The site rebuilds in about a minute.',
        })
      } else {
        setNote({ tone: 'bad', text: result.error ?? 'Could not publish.' })
      }
      return result
    } finally {
      setPublishing(false)
    }
  }, [])

  // The browser's own guard. It is the only thing that can catch a closed tab,
  // and an unpublished edit is worth one line of friction on the way out.
  useEffect(() => {
    if (!dirty || !signedIn) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, signedIn])

  // A note is a reply to something the editor just did, not a state of the
  // site. Four seconds is long enough to read one line and short enough that
  // it is gone before it becomes furniture. Failures stay: they are the ones
  // worth re-reading, and the ones the editor may need to act on.
  useEffect(() => {
    if (!note || note.tone !== 'ok') return
    const t = window.setTimeout(() => setNote(null), 4000)
    return () => window.clearTimeout(t)
  }, [note])

  // Edit mode paints outlines over everything, which is exactly wrong for a
  // screenshot or a look at the real thing. Escape is the way out that needs no
  // aiming, and it closes the drawer first so it never does two things at once.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const el = document.activeElement
      if (el instanceof HTMLElement && el.isContentEditable) return
      if (drawer) setDrawer(null)
      else setEditing(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, drawer, setEditing])

  const value = useMemo<EditSession>(
    () => ({
      signedIn,
      editing: signedIn && editing,
      dirty,
      note,
      publishing,
      signIn,
      signOut,
      setEditing,
      set,
      commit,
      read,
      replace,
      save,
      discard,
      publish,
      say: setNote,
      drawer,
      openDrawer: setDrawer,
    }),
    [
      signedIn,
      editing,
      dirty,
      note,
      publishing,
      signIn,
      signOut,
      setEditing,
      set,
      commit,
      read,
      replace,
      save,
      discard,
      publish,
      drawer,
    ],
  )

  return <EditContext.Provider value={value}>{children}</EditContext.Provider>
}

/** The session. Safe to call from anywhere; inert for a visitor. */
export function useEdit(): EditSession {
  return useContext(EditContext)
}

/**
 * Whether the page should render its editing affordances.
 *
 * A component asks this rather than `signedIn && editing` so there is one
 * answer to "are we editing right now" and one place to change it.
 */
export function useEditing(): boolean {
  return useEdit().editing
}
