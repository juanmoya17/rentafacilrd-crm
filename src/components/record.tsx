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
}: {
  backTo: string
  title: string
  subtitle?: string
  badges?: ReactNode
  actions?: ReactNode
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
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {badges && <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>}
    </header>
  )
}

/**
 * Label/value rows. Values are mono when numeric so a column of prices, areas
 * and counts lines up instead of ragging.
 */
export function FactList({
  facts,
}: {
  facts: { label: string; value: ReactNode; numeric?: boolean }[]
}) {
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

/** Small section label above a spine or rail block. */
export function RecordSectionHead({ label, count }: { label: string; count?: number }) {
  return (
    <h2 className="mb-2 flex items-baseline gap-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {count !== undefined && <span className="font-mono text-xs text-muted">{count}</span>}
    </h2>
  )
}
