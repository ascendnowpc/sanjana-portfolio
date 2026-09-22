import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type {
  Category,
  CategoryId,
  Performance,
  SiteContent,
} from '@/types/content'
import {
  getContent,
  hydrateFromRemote,
  isRemotePending,
  subscribe,
} from '@/lib/contentStore'

/**
 * Live content, for the whole tree.
 *
 * `useSyncExternalStore` rather than a state-and-effect pair: the store is
 * already the source of truth and already notifies, and the panel edits it
 * from a route that is mounted inside this same provider. Subscribing to it
 * directly is what makes an edit show up on the page behind the panel in the
 * same frame it is typed, without the provider having to own a copy that can
 * fall behind.
 */

const ContentContext = createContext<SiteContent>(getContent())

export function ContentProvider({ children }: { children: ReactNode }) {
  const content = useSyncExternalStore(subscribe, getContent, getContent)

  // Supabase, if it is configured. Fire and forget: the store emits when it
  // lands and this component re-renders through the subscription above.
  useEffect(() => {
    void hydrateFromRemote()
  }, [])

  return (
    <ContentContext.Provider value={content}>
      {children}
    </ContentContext.Provider>
  )
}

/** The whole content object. Prefer one of the narrower hooks below. */
export function useSiteContent(): SiteContent {
  return useContext(ContentContext)
}

export function useProfile() {
  return useSiteContent().profile
}

/** Every fixed string on the site. See `UiCopy`. */
export function useUi() {
  return useSiteContent().ui
}

export function usePortraitCopy() {
  return useSiteContent().portrait
}

export function useTestimonials() {
  return useSiteContent().testimonials
}

export function useMusicCopy() {
  return useSiteContent().music
}

export function useCategories(): Category[] {
  return useSiteContent().categories
}

/** Categories keyed by id, for the many places that look one up by `p.category`. */
export function useCategoryMap(): Record<CategoryId, Category> {
  const categories = useCategories()
  return useMemo(
    () =>
      Object.fromEntries(categories.map((c) => [c.id, c])) as Record<
        CategoryId,
        Category
      >,
    [categories],
  )
}

/**
 * The archive.
 *
 * `loading` is kept for the one caller that needs it — the detail page holds
 * rather than bouncing to 404 while a slug it has not seen yet might still be
 * arriving from the database.
 */
export function usePerformances(): {
  items: Performance[]
  loading: boolean
} {
  const items = useSiteContent().performances
  const loading = useSyncExternalStore(
    subscribe,
    isRemotePending,
    isRemotePending,
  )
  return { items, loading }
}
