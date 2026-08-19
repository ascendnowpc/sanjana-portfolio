import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Route changes should land at the top, not wherever the last page was. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}
