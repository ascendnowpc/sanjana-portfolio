import { motion } from 'framer-motion'

interface Props {
  text: string
  className?: string
  delay?: number
  /** Seconds between each word. */
  stagger?: number
}

/**
 * Word-by-word rise. Each word gets its own clipping box so the letters
 * appear to lift out from behind a mask rather than just fading.
 */
export function SplitText({ text, className, delay = 0, stagger = 0.055 }: Props) {
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-bottom"
        >
          <motion.span
            className="inline-block"
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{
              duration: 1,
              delay: delay + i * stagger,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  )
}
