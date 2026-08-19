import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface Props {
  to: string
  children: ReactNode
  className?: string
  /** Pull radius, in px of travel at the edge of the element. */
  strength?: number
}

/**
 * A link that leans toward the cursor. Transform is written directly rather
 * than through state so it tracks the pointer without a render per move.
 */
export function MagneticLink({ to, children, className, strength = 14 }: Props) {
  const ref = useRef<HTMLAnchorElement>(null)

  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    el.style.transform = `translate(${dx * strength}px, ${dy * strength * 0.6}px)`
  }

  const reset = () => {
    const el = ref.current
    if (el) el.style.transform = 'translate(0,0)'
  }

  return (
    <Link
      ref={ref}
      to={to}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn(
        'inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        className,
      )}
    >
      {children}
    </Link>
  )
}
