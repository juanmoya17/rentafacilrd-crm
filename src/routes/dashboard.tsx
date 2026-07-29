import { Link } from 'react-router'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { Card, MockNotice, PageHeader } from '@/components/ui'
import { LEADS, PROPERTIES, isSlaBreached } from '@/lib/mock/data'

const EXPIRY_WINDOW_MS = 3 * 86_400_000

export function DashboardPage() {
  const { state } = useAuth()
  const { t } = useI18n()
  if (state.status !== 'authenticated') return null

  const published = PROPERTIES.filter((property) => property.lifecycle === 'published')
  const expiring = PROPERTIES.filter(
    (property) =>
      property.featuredExpiresAt !== null &&
      new Date(property.featuredExpiresAt).getTime() - Date.now() < EXPIRY_WINDOW_MS,
  )
  const newLeads = LEADS.filter((lead) => lead.stage === 'new')

  // A.5 — every KPI is a shortcut that lands on the filtered list, not a dead number.
  const kpis: { label: TranslationKey; value: number; to: string }[] = [
    { label: 'dashboard.kpi.total', value: PROPERTIES.length, to: '/properties' },
    { label: 'dashboard.kpi.published', value: published.length, to: '/properties?status=published' },
    { label: 'dashboard.kpi.newLeads', value: newLeads.length, to: '/leads?stage=new' },
    { label: 'dashboard.kpi.expiring', value: expiring.length, to: '/properties?featured=expiring' },
  ]

  // A.6 — four categories from two sources. The rail disappears when empty.
  const railItems: { label: TranslationKey; value: number; to: string }[] = [
    { label: 'dashboard.slaBreached', value: LEADS.filter(isSlaBreached).length, to: '/leads?sla=breached' },
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
      <MockNotice>{t('mock.notice', { milestone: 'C.1 / C.2' })}</MockNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            to={kpi.to}
            className="rounded-lg border border-slate-200 bg-surface-raised p-4 transition-colors hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{t(kpi.label)}</p>
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
