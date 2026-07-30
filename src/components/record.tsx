import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'

/**
 * The Record family — the shared head for the three detail screens.
 *
 * The title carries `view-transition-name: record-title` unconditionally rather
 * than conditionally. On a list there are fifty candidate rows, so the name has
 * to be applied only to the one being navigated from (a duplicate name aborts
 * the transition). On a record there is exactly one title, so there is nothing
 * to disambiguate — and applying it always means the morph also works when
 * arriving from somewhere that had no matching element, where it simply reads
 * as the title settling in.
 */
export function RecordHeader({
  backTo,
  title,
  subtitle,
  badges,
  actions,
  media,
  meta,
}: {
  backTo: string
  title: string
  subtitle?: string
  badges?: ReactNode
  actions?: ReactNode
  /**
   * Sits between the back link and the title. For records whose photography
   * is the first thing an agent wants — the listing gallery — rather than a
   * block that has to be scrolled past the title to reach.
   */
  media?: ReactNode
  /** One glanceable line under the subtitle. Specs, not badges. */
  meta?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <header className="mb-5">
      <Link
        to={backTo}
        viewTransition
        className="mb-3 inline-flex min-h-8 items-center gap-1 text-sm text-brand-700 transition-colors duration-(--duration-fast) ease-out hover:text-brand-800"
      >
        <span aria-hidden="true">←</span>
        {t('common.back')}
      </Link>

      {media && <div className="mb-4">{media}</div>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* overflow-wrap so a long unbroken title (an RF code, a compound
              Spanish place name) cannot push the record past the viewport. */}
          <h1
            style={{ viewTransitionName: 'record-title' }}
            className="min-w-0 text-lg font-semibold tracking-tight text-ink [overflow-wrap:anywhere]"
          >
            {title}
          </h1>
          {subtitle !== undefined && subtitle !== '' && (
            <p className="mt-0.5 font-mono text-sm text-muted">{subtitle}</p>
          )}
          {meta && <div className="mt-1.5">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {badges && <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>}
    </header>
  )
}

export interface Fact {
  label: string
  value: ReactNode
  /** Mono + tabular, so a column of prices, areas and counts lines up. */
  numeric?: boolean
}

/**
 * Label/value rows for a narrow rail — label and value share a baseline and
 * the value is flushed right, which only reads well in a single column.
 *
 * For a full-width section use `FactGrid` instead; a five-fact rail squeezed
 * beside a main column is what that shape replaced on property-detail.
 */
export function FactList({ facts }: { facts: Fact[] }) {
  return (
    <dl className="divide-y divide-rule">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
          <dt className="shrink-0 text-muted">{fact.label}</dt>
          <dd
            className={`min-w-0 text-right font-medium text-ink ${
              fact.numeric === true ? 'font-mono' : ''
            }`}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Label-above-value grid — the wide counterpart to `FactList`.
 *
 * The label sits above its value rather than beside it, so a record can carry
 * twelve facts across four columns without any of them ragging against a
 * right edge. `min-w-0` plus `overflow-wrap` on the value because a long city
 * name or a null-dashed field must wrap inside its own track and never widen
 * it — a grid track's automatic minimum is `min-content`, so without this one
 * long value stretches the whole row.
 */
export function FactGrid({ facts }: { facts: Fact[] }) {
  return (
    /* One column below 360px. Two 140px-wide tracks cannot hold a formatted
       DOP price, and the result was "DOP 14,500,00" wrapping to a lone "0" on
       the next line — a number broken across lines reads as a different
       number. */
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-xs text-muted">{fact.label}</dt>
          <dd
            /* `anywhere` breaks a long unbroken word (a compound place name)
               inside its own track rather than widening it — but never on a
               numeric value, where the break would land mid-figure. */
            className={`mt-1 text-sm font-medium text-ink ${
              fact.numeric === true ? 'font-mono' : '[overflow-wrap:anywhere]'
            }`}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Small section label above a spine or rail block. */
export function RecordSectionHead({ label, count }: { label: string; count?: number }) {
  return (
    <h2 className="mb-2 flex items-baseline gap-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {count !== undefined && <span className="font-mono text-xs text-muted">{count}</span>}
    </h2>
  )
}
