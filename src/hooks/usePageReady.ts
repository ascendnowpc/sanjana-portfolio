import { useEffect, useState } from 'react'

/**
 * Whether the first load has finished: `window.load`, or a ceiling, whichever
 * comes first — the same two the preloader lifts on.
 *
 * The index uses it to hold its opening until the posters are in. Played
 * against a page still loading, the room would rise out of black as a field
 * of empty frames, and the first second of it — the part everybody sees — would
 * be spent on decoding.
 *
 * Once ready, always ready: a later visit to the index in the same page load
 * reads true on its first render.
 */
const CEILING_MS = 1800

let ready = typeof document !== 'undefined' && document.readyState === 'complete'
const waiting = new Set<() => void>()

function settle() {
  if (ready) return
  ready = true
  waiting.forEach((fn) => fn())
  waiting.clear()
}

if (!ready && typeof window !== 'undefined') {
  window.addEventListener('load', settle, { once: true })
  window.setTimeout(settle, CEILING_MS)
}

export function usePageReady(): boolean {
  const [isReady, setReady] = useState(ready)
  useEffect(() => {
    if (ready) {
      setReady(true)
      return
    }
    const fn = () => setReady(true)
    waiting.add(fn)
    return () => {
      waiting.delete(fn)
    }
  }, [])
  return isReady
}
