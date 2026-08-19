import { useEffect, useState } from 'react'
import type { Performance } from '@/types/content'
import { getPerformances } from '@/lib/content'
import { PERFORMANCES } from '@/data/performances'

/**
 * Performances, resolved through the content repository.
 *
 * Seeded with the bundled data so the first paint never flashes empty —
 * when Supabase is off (the default) this never re-renders at all.
 */
export function usePerformances() {
  const [items, setItems] = useState<Performance[]>(PERFORMANCES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getPerformances().then((data) => {
      if (!alive) return
      setItems(data)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  return { items, loading }
}
