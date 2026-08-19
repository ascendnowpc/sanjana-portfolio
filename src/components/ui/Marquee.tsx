import { cn } from '@/lib/utils'

interface Props {
  text: string
  className?: string
  repeat?: number
}

/**
 * The oversized drifting name behind the portrait strip (reference: the
 * "MIDNIGHT MAVEN" band). Content is duplicated so the loop is seamless.
 */
export function Marquee({ text, className, repeat = 4 }: Props) {
  const run = Array.from({ length: repeat }, () => text)
  return (
    <div
      className={cn('pointer-events-none w-full overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0">
            {run.map((t, i) => (
              <span
                key={i}
                className="px-6 font-[family-name:var(--font-poster)] leading-[0.8] whitespace-nowrap"
                style={{ fontSize: 'clamp(4rem, 15vw, 14rem)' }}
              >
                {t}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
