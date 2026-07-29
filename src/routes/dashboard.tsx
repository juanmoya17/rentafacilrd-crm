import { Link } from 'react-router'
import { motion } from 'motion/react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { Card, MockNotice, PageHeader } from '@/components/ui'
import { CountUp } from '@/components/count-up'
import { RecordSectionHead } from '@/components/record'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { listLeads } from '@/lib/crm/api'
import { PROPERTIES } from '@/lib/mock/data'

const EXPIRY_WINDOW_MS = 3 * 86_400_000

export function DashboardPage() {
  const { state } = useAuth()
  const { t } = useI18n()
  const reveal = useRowReveal()

  // Lead counts are real; the property ones wait for A.5. Showing a fake number
  // beside a real one is worse than showing fewer numbers, so the notice below
  // says exactly which half is which.
  const newLeads = useResource((signal) => listLeads({ stage: 'new', limit: 1 }, signal), [])
  const breached = useResource((signal) => listLeads({ sla: 'breached', limit: 1 }, signal), [])

  if (state.status !== 'authenticated') return null

  /** null until the request lands — CountUp renders an em dash, never a zero. */
  const total = (resource: typeof newLeads): number | null =>
    resource.status === 'ready' ? resource.data.total : null

  const published = PROPERTIES.filter((property) => property.lifecycle === 'published')
  const expiring = PROPERTIES.filter(
    (property) =>
      property.featuredExpiresAt !== null &&
      new Date(property.featuredExpiresAt).getTime() - Date.now() < EXPIRY_WINDOW_MS,
  )

  // A.5 — every KPI is a shortcut that lands on the filtered list, not a dead number.
  const kpis: { label: TranslationKey; value: number | null; to: string; live: boolean }[] = [
    { label: 'dashboard.kpi.total', value: PROPERTIES.length, to: '/properties', live: false },
    {
      label: 'dashboard.kpi.published',
      value: published.length,
      to: '/properties?status=published',
      live: false,
    },
    { label: 'dashboard.kpi.newLeads', value: total(newLeads), to: '/leads?stage=new', live: true },
    {
      label: 'dashboard.kpi.expiring',
      value: expiring.length,
      to: '/properties?featured=expiring',
      live: false,
    },
  ]

  // A.6 — the rail disappears when there is nothing pending.
  const railItems: { label: TranslationKey; value: number; to: string }[] = [
    {
      label: 'dashboard.slaBreached',
      value: breached.status === 'ready' ? breached.data.total : 0,
      to: '/leads?sla=breached',
    },
    {
      label: 'dashboard.unanswered',
      value: PROPERTIES.filter((property) => property.unansweredLeads > 0).length,
      to: '/properties?leads=unanswered',
    },
    {
      label: 'dashboard.featuredExpiring',
      value: expiring.length,
      to: '/properties?featured=expiring',
    },
    {
      label: 'dashboard.rejected',
      value: PROPERTIES.filter((property) => property.lifecycle === 'rejected').length,
      to: '/properties?status=rejected',
    },
  ]
  const rail = railItems.filter((item) => item.value > 0)

  return (
    <>
      <PageHeader
        title={t('dashboard.greeting', { name: state.user.name })}
        subtitle={t('dashboard.title')}
      />
      <MockNotice>{t('dashboard.partialLive')}</MockNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div key={kpi.label} {...reveal(index)}>
            <Link
              to={kpi.to}
              viewTransition
              className="flex h-full flex-col rounded-lg border border-rule bg-surface-raised p-4 transition-colors duration-(--duration-base) ease-out hover:border-rule-2"
            >
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted">
                {t(kpi.label)}
                {/* The live dot marks which half of this board is real data —
                    the other half is still A.5 placeholder. */}
                {kpi.live && (
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                )}
              </p>
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
