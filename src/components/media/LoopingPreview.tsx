import { useEffect, useRef } from 'react'

interface Props {
  /** Already resolved through `mediaUrl` — this component does no rewriting. */
  src: string
  poster?: string
  className?: string
  /** `object-position` for the crop, when the surface fills a frame that is
   *  not the footage's own shape. */
  objectPosition?: string
}

/**
 * A short, silent, looping preview, mounted only while its surface has decided
 * this clip is worth a decoder.
 *
 * Lifted out of the gallery tile so the work reel plays footage on exactly the
 * same terms: the element's whole life — start, first frame, release — happens
 * in one effect. An earlier version drove it from an inline `ref` callback,
 * which React tears down and re-runs on every render of the parent, so `play()`
 * fired repeatedly and raced its own promise.
 *
 * Autoplay is asked for more than once, on purpose. See `start` below.
 */
export function LoopingPreview({
  src,
  poster,
  className = 'absolute inset-0 h-full w-full object-cover',
  objectPosition,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null)

  // The source is attached here rather than as a `src` prop, because the
  // teardown below detaches it and React would not know to put it back: it
  // still believes the attribute holds the value it rendered. Under
  // StrictMode, which runs every effect twice, that left every preview
  // pointing at nothing.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Set here as well as in the JSX. Muted-inline is the entire basis on
    // which a browser grants autoplay, and it is checked against the element's
    // own state at the moment `play()` is called — not against what React
    // believes it rendered.
    el.muted = true
    el.playsInline = true
    el.src = src

    /**
     * Ask to play — and keep asking at each point where a refusal may have
     * stopped being justified.
     *
     * One attempt is not enough, and this is the likeliest reason a row of
     * frames sits still in Safari while playing perfectly in Chrome. WebKit
     * grants muted autoplay only to a video it considers *visible*, and it
     * decides that at the instant `play()` is called — which here was while
     * the element was still transparent, waiting for its first frame. The
     * promise rejected, the rejection was swallowed as harmless, the frame
     * arrived, the element faded in, and nothing ever asked again. A card
     * that had been refused once stayed refused for the life of the page.
     *
     * So: once now, again when there is enough decoded to show, and again on
     * the visitor's first click or touch anywhere — a gesture lifts the block
     * outright, and the whole row catches up at once.
     */
    const start = () => {
      if (el.paused) void el.play().catch(() => {})
    }
    start()
    el.addEventListener('canplay', start)
    window.addEventListener('pointerdown', start)

    return () => {
      el.removeEventListener('canplay', start)
      window.removeEventListener('pointerdown', start)
      // Dropping the node is not enough to hand the decoder back promptly —
      // the element can sit in the media pool still holding it, which is
      // exactly the resource the budget upstream exists to ration.
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
  }, [src])

  return (
    <video
      ref={ref}
      className={className}
      style={objectPosition ? { objectPosition } : undefined}
      // Its own poster, rather than fading in from transparent over the still
      // underneath. The two look identical — it is the same image — and this
      // way the element is opaque and visible from the moment it mounts,
      // which is the state WebKit wants to see before it will play anything.
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
    />
  )
}
