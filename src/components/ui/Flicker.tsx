import { useMemo } from 'react'

interface Props {
  text: string
  /** Seconds before the first letter can start. */
  delay?: number
  /** Seconds over which the letters' starts are scattered. */
  spread?: number
}

/**
 * Lettering that flickers on a letter at a time, the way the reference brings
 * in its welcome sentence and its name: each letter catches, drops out and
 * catches again on its own schedule, so for a moment the word is there in
 * pieces — "M CH  L G T" — before it holds.
 *
 * Every letter gets a random start inside `spread` and a random length, and
 * runs the `flicker-in` keyframes (index.css), which step rather than fade:
 * a flicker is on or off, and a cross-fade between the two reads as a
 * dissolve instead. The schedule is drawn once per text, so a re-render does
 * not start it again.
 *
 * Screen readers get the word whole; the letters are hidden from them.
 */
export function Flicker({ text, delay = 0, spread = 0.9 }: Props) {
  const letters = useMemo(
    () =>
      Array.from(text, (char) => ({
        char,
        start: delay + Math.random() * spread,
        length: 0.35 + Math.random() * 0.4,
      })),
    [text, delay, spread],
  )

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {letters.map((l, i) => (
          <span
            key={i}
            className="flicker-in"
            style={{
              animationDelay: `${l.start.toFixed(3)}s`,
              animationDuration: `${l.length.toFixed(3)}s`,
            }}
          >
            {l.char}
          </span>
        ))}
      </span>
    </>
  )
}
