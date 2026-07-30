import { Link } from 'react-router'
import { motion } from 'motion/react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { CountUp } from '@/components/count-up'
import { RecordSectionHead } from '@/components/record'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { listLeads } from '@/lib/crm/api'
import { getPropertySummary, listProperties } from '@/lib/crm/properties'

export function DashboardPage() {
  const { state } = useAuth()
  const { t } = useI18n()
  const reveal = useRowReveal()

  const newLeads = useResource((signal) => listLeads({ stage: 'new', limit: 1 }, signal), [])
  const breached = useResource((signal) => listLeads({ sla: 'breached', limit: 1 }, signal), [])
  // A.5 — same summary endpoint the properties screen's KPI strip uses.
  const summary = useResource((signal) => getPropertySummary(signal), [])
  // Unlike "unanswered leads," rejected listings ARE expressible as a filter
  // today — same idiom as newLeads/breached above, just against properties.
  const rejected = useResource(
    (signal) => listProperties({ lifecycle: 'rejected', limit: 1 }, signal),
    [],
  )

  if (state.status !== 'authenticated') return null

  /** null until the request lands — CountUp renders an em dash, never a zero. */
  const total = (resource: typeof newLeads): number | null =>
    resource.status === 'ready' ? resource.data.total : null

  // A.5 — every KPI is a shortcut that lands on the filtered list, not a dead
  // number. `featured_expiring=true` mirrors KpiStrip's own mapping for
  // "expiring" (kpi-strip.tsx) — the exact active-ad-expiring-soon predicate
  // the count itself uses, not the broader is_featured (any active ad).
  const kpis: { label: TranslationKey; value: number | null; to: string }[] = [
    {
      label: 'dashboard.kpi.total',
      value: summary.status === 'ready' ? summary.data.total : null,
      to: '/properties',
    },
    {
      label: 'dashboard.kpi.published',
      value: summary.status === 'ready' ? summary.data.published : null,
      to: '/properties?lifecycle=published',
    },
    { label: 'dashboard.kpi.newLeads', value: total(newLeads), to: '/leads?stage=new' },
    {
      label: 'dashboard.kpi.expiring',
      value: summary.status === 'ready' ? summary.data.expiring_featured : null,
      to: '/properties?featured_expiring=true',
    },
  ]

  // A.6 — the rail disappears when there is nothing pending. "Unanswered
  // leads" (no first response, regardless of SLA) stays out on purpose: the
  // only aggregate that exists is `sla_breached` — a strict subset (also
  // past due) — and that's exactly what the row below already shows. A
  // second row reading "unanswered" over the same number and the same
  // /leads?sla=breached link would be copy that lies about what it counts,
  // and two rows for one number is the noise A.6 exists to remove. Add a
  // real "unanswered" row only once a superset aggregate exists to back it.
  const railItems: { label: TranslationKey; value: number; to: string }[] = [
    {
      label: 'dashboard.slaBreached',
      value: breached.status === 'ready' ? breached.data.total : 0,
      to: '/leads?sla=breached',
    },
    {
      label: 'dashboard.featuredExpiring',
      value: summary.status === 'ready' ? summary.data.expiring_featured : 0,
      to: '/properties?featured_expiring=true',
    },
    {
      label: 'dashboard.rejected',
      value: rejected.status === 'ready' ? rejected.data.total : 0,
      to: '/properties?lifecycle=rejected',
    },
  ]
  const rail = railItems.filter((item) => item.value > 0)

  return (
    <>
      <PageHeader
        title={t('dashboard.greeting', { name: state.user.name })}
        subtitle={t('dashboard.title')}
      />

      {/* Three of the four KPI tiles read this fetch — without a retry here,
          a failure leaves three permanent em dashes with no way out. */}
      {summary.status === 'error' && (
        <div className="mb-3">
          <ErrorState message={summary.message} retryLabel={t('common.retry')} onRetry={summary.reload} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div key={kpi.label} {...reveal(index)}>
            <Link
              to={kpi.to}
              viewTransition
              className="flex h-full flex-col rounded-lg border border-rule bg-surface-raised p-4 transition-colors duration-(--duration-base) ease-out hover:border-rule-2"
            >
              <p className="text-xs uppercase tracking-wider text-muted">{t(kpi.label)}</p>
              <p className="mt-1">
                <CountUp value={kpi.value} />
              </p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-8">
        <RecordSectionHead label={t('dashboard.needsAction')} count={rail.length} />
      </div>

      {rail.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-muted">{t('dashboard.needsActionEmpty')}</Card>
      ) : (
        /* Was four filled amber cards, which put more colour on this screen than
           the teal accent and made the whole board read as an alert. It is now
           one queue: hairline rows, a single amber spine per row, the count in
           mono. Same information, and the accent is the loudest thing again. */
        <ul className="overflow-hidden rounded-lg border border-rule bg-surface-raised">
          {rail.map((item, index) => (
            <motion.li key={item.label} {...reveal(index)} className="border-b border-rule last:border-0">
              <Link
                to={item.to}
                viewTransition
                className="flex items-center gap-3 border-l-2 border-l-warning px-4 py-3 transition-colors duration-(--duration-base) ease-out hover:bg-surface-sunken"
              >
                <span className="w-8 shrink-0 font-mono text-base font-semibold text-warning">
                  {item.value}
                </span>
                <span className="min-w-0 flex-1 text-sm text-ink-2">{t(item.label)}</span>
                <span aria-hidden="true" className="shrink-0 text-sm text-muted">
                  →
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  )
}
