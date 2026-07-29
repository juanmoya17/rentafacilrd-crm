import { Link, useParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Button, Card, EmptyState, MockNotice, PageHeader, ScoreDot } from '@/components/ui'
import { LifecycleBadge, OperationBadge, StageBadge } from '@/components/labels'
import { LEADS, PROPERTIES, scoreBand } from '@/lib/mock/data'

export function PropertyDetailPage() {
  const { code } = useParams()
  const { t, formatCurrency, formatNumber, formatDate, formatRelativeTime } = useI18n()

  const property = PROPERTIES.find((item) => item.code === code)
  if (property === undefined) {
    return (
      <EmptyState
        title={t('error.notFound')}
        action={<Link to="/properties"><Button>{t('common.back')}</Button></Link>}
      />
    )
  }

  const leads = LEADS.filter((lead) => lead.propertyCode === property.code)

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
      <MockNotice>{t('mock.notice', { milestone: 'C.7' })}</MockNotice>

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
          {leads.length === 0 ? (
            <EmptyState title={t('propertyDetail.emptyLeads')} />
          ) : (
            <ul className="space-y-2">
              {leads.map((lead) => (
                <li key={lead.id}>
                  <Card className="flex flex-wrap items-center gap-3 p-3">
                    <Link
                      to={`/leads/${lead.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-brand-700"
                    >
                      {lead.name}
                    </Link>
                    <ScoreDot score={lead.score} band={scoreBand(lead.score)} />
                    <StageBadge stage={lead.stage} />
                    <span className="ml-auto text-xs tabular-nums text-slate-400">
                      {formatRelativeTime(lead.lastActivityAt)}
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
