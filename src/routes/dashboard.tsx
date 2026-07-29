import { Link } from 'react-router'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { Card, MockNotice, PageHeader } from '@/components/ui'
import { useResource } from '@/lib/use-resource'
import { listLeads } from '@/lib/crm/api'
import { PROPERTIES } from '@/lib/mock/data'

const EXPIRY_WINDOW_MS = 3 * 86_400_000

export function DashboardPage() {
  const { state } = useAuth()
  const { t } = useI18n()

  // Lead counts are real; the property ones wait for A.5. Showing a fake number
  // beside a real one is worse than showing fewer numbers, so the notice below
  // says exactly which half is which.
  const newLeads = useResource((signal) => listLeads({ stage: 'new', limit: 1 }, signal), [])
  const breached = useResource((signal) => listLeads({ sla: 'breached', limit: 1 }, signal), [])

  if (state.status !== 'authenticated') return null

  const count = (resource: typeof newLeads): string =>
    resource.status === 'ready' ? String(resource.data.total) : '—'

  const published = PROPERTIES.filter((property) => property.lifecycle === 'published')
  const expiring = PROPERTIES.filter(
    (property) =>
      property.featuredExpiresAt !== null &&
      new Date(property.featuredExpiresAt).getTime() - Date.now() < EXPIRY_WINDOW_MS,
  )

  // A.5 — every KPI is a shortcut that lands on the filtered list, not a dead number.
  const kpis: { label: TranslationKey; value: string; to: string; live: boolean }[] = [
    { label: 'dashboard.kpi.total', value: String(PROPERTIES.length), to: '/properties', live: false },
    { label: 'dashboard.kpi.published', value: String(published.length), to: '/properties?status=published', live: false },
    { label: 'dashboard.kpi.newLeads', value: count(newLeads), to: '/leads?stage=new', live: true },
    { label: 'dashboard.kpi.expiring', value: String(expiring.length), to: '/properties?featured=expiring', live: false },
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
    { label: 'dashboard.featuredExpiring', value: expiring.length, to: '/properties?featured=expiring' },
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
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            to={kpi.to}
            className="rounded-lg border border-slate-200 bg-surface-raised p-4 transition-colors hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
              {t(kpi.label)}
              {kpi.live && <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{kpi.value}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-slate-900">
        {t('dashboard.needsAction')}
      </h2>

      {rail.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-slate-500">
          {t('dashboard.needsActionEmpty')}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rail.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <p className="text-2xl font-semibold tabular-nums text-amber-900">{item.value}</p>
              <p className="mt-0.5 text-sm text-amber-800">{t(item.label)}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
