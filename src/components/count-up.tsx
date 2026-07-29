import { useEffect } from 'react'
import { animate, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'

/**
 * Counts a KPI up from zero once its value arrives.
 *
 * Two things this gets right that a naive counter does not:
 *
 *  - **The value, not the element, is eased.** Animating opacity on a number
 *    that has already rendered tells the reader nothing; ticking the figure is
 *    what draws the eye to the one that changed.
 *  - **`aria-live` announces the final figure, not every frame.** The animated
 *    span is hidden from assistive tech and a plain one carries the value, so a
 *    screen reader hears "8", not "1 2 3 4 5 6 7 8".
 *
 * A null value means "not loaded" and renders an em dash — never a zero, which
 * would read as a real measurement.
 */
export function CountUp({ value }: { value: number | null }) {
  const still = useReducedMotion()
  const { formatNumber } = useI18n()
  const raw = useMotionValue(0)
  const shown = useTransform(raw, (latest) => formatNumber(Math.round(latest)))

  useEffect(() => {
    if (value === null) return
    if (still === true) {
      raw.set(value)
      return
    }
    const controls = animate(raw, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [value, still, raw])

  if (value === null) {
    return <span className="font-mono text-2xl font-semibold text-muted">—</span>
  }

  return (
    <>
      <motion.span aria-hidden="true" className="font-mono text-2xl font-semibold text-ink">
        {shown}
      </motion.span>
      <span className="sr-only" aria-live="polite">
        {formatNumber(value)}
      </span>
    </>
  )
}
