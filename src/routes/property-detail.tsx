import { Link, useParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  MockNotice,
  PageHeader,
  ScoreDot,
} from '@/components/ui'
import { LifecycleBadge, OperationBadge, StageBadge } from '@/components/labels'
import { useResource } from '@/lib/use-resource'
import { listLeads } from '@/lib/crm/api'
import { PROPERTIES } from '@/lib/mock/data'

export function PropertyDetailPage() {
  const { code } = useParams()
  const { t, formatCurrency, formatNumber, formatDate, formatRelativeTime } = useI18n()

  // The listing itself is still placeholder data (A.1–A.8); its leads are real.
  const property = PROPERTIES.find((item) => item.code === code)

  const leads = useResource(
    (signal) => listLeads({ property_id: property?.id, limit: 50 }, signal),
    [property?.id],
  )

  if (property === undefined) {
    return (
      <EmptyState
        title={t('error.notFound')}
        action={<Link to="/properties"><Button>{t('common.back')}</Button></Link>}
      />
    )
  }

  const specs: { label: string; value: string }[] = [
    { label: t('common.price'), value: formatCurrency(property.price) },
    { label: t('common.bedrooms'), value: String(property.bedrooms) },
    { label: t('common.bathrooms'), value: String(property.bathrooms) },
    { label: t('common.parking'), value: String(property.parking) },
    { label: t('common.area'), value: `${formatNumber(property.area)} m²` },
    { label: t('common.city'), value: `${property.sector}, ${property.city}` },
  ]

  return (
    <>
      <Link to="/properties" className="mb-3 inline-block text-sm text-brand-700 hover:underline">
        ← {t('common.back')}
      </Link>

      <PageHeader title={property.title} subtitle={property.code} />
      <MockNotice>{t('propertyDetail.partialLive')}</MockNotice>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LifecycleBadge lifecycle={property.lifecycle} />
        <OperationBadge operation={property.operation} />
        {property.featuredExpiresAt !== null && (
          <span className="text-xs text-slate-500">
            {t('properties.featuredUntil', { date: formatDate(property.featuredExpiresAt) })}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            {t('propertyDetail.specs')}
          </h2>
          <dl className="space-y-2">
            {specs.map((spec) => (
              <div key={spec.label} className="flex justify-between gap-3 text-sm">
                <dt className="text-slate-500">{spec.label}</dt>
                <dd className="tabular-nums font-medium text-slate-900">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            {t('propertyDetail.leads')}
          </h2>

          {leads.status === 'loading' && <LoadingState label={t('common.loading')} />}

          {leads.status === 'error' && (
            <ErrorState
              message={leads.message}
              retryLabel={t('common.retry')}
              onRetry={leads.reload}
            />
          )}

          {leads.status === 'ready' &&
            (leads.data.items.length === 0 ? (
              <EmptyState title={t('propertyDetail.emptyLeads')} />
            ) : (
              <ul className="space-y-2">
                {leads.data.items.map((lead) => (
                  <li key={lead.id}>
                    <Card className="flex flex-wrap items-center gap-3 p-3">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {lead.contact?.name ?? '—'}
                      </Link>
                      <ScoreDot score={lead.score} band={lead.score_band} />
                      <StageBadge stage={lead.stage} />
                      {lead.last_activity_at !== null && (
                        <span className="ml-auto text-xs tabular-nums text-slate-400">
                          {formatRelativeTime(lead.last_activity_at)}
                        </span>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>
    </>
  )
}
