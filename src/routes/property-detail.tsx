import { Link, useParams } from 'react-router'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  MockNotice,
  ScoreDot,
} from '@/components/ui'
import { FactList, RecordHeader, RecordSectionHead } from '@/components/record'
import { LifecycleBadge, OperationBadge, StageBadge } from '@/components/labels'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { listLeads } from '@/lib/crm/api'
import { PROPERTIES } from '@/lib/mock/data'

export function PropertyDetailPage() {
  const { code } = useParams()
  const { t, formatCurrency, formatNumber, formatDate, formatRelativeTime } = useI18n()
  const reveal = useRowReveal()

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
        action={
          <Link to="/properties" viewTransition>
            <Button>{t('common.back')}</Button>
          </Link>
        }
      />
    )
  }

  const specs = [
    { label: t('common.price'), value: formatCurrency(property.price), numeric: true },
    { label: t('common.bedrooms'), value: String(property.bedrooms), numeric: true },
    { label: t('common.bathrooms'), value: String(property.bathrooms), numeric: true },
    { label: t('common.parking'), value: String(property.parking), numeric: true },
    { label: t('common.area'), value: `${formatNumber(property.area)} m²`, numeric: true },
    { label: t('common.city'), value: `${property.sector}, ${property.city}` },
  ]

  return (
    <>
      <RecordHeader
        backTo="/properties"
        title={property.title}
        subtitle={property.code}
        badges={
          <>
            <LifecycleBadge lifecycle={property.lifecycle} />
            <OperationBadge operation={property.operation} />
            {property.featuredExpiresAt !== null && (
              <span className="font-mono text-xs text-muted">
                {t('properties.featuredUntil', {
                  date: formatDate(property.featuredExpiresAt),
                })}
              </span>
            )}
          </>
        }
      />
      <MockNotice>{t('propertyDetail.partialLive')}</MockNotice>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* The rail leads on this record: the specs are what an agent reads out
            on the phone, so they sit first in DOM order and first on mobile. */}
        <div className="lg:col-span-1">
          <RecordSectionHead label={t('propertyDetail.specs')} />
          <Card className="p-4">
            <FactList facts={specs} />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <RecordSectionHead
            label={t('propertyDetail.leads')}
            count={leads.status === 'ready' ? leads.data.total : undefined}
          />

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
                {leads.data.items.map((lead, index) => (
                  <motion.li key={lead.id} {...reveal(index)}>
                    <Card className="relative p-3 transition-colors duration-(--duration-base) ease-out hover:border-rule-2">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* rf-cardlink stretches this link over the card, so the
                            whole row is the target with one anchor in it. */}
                        <span className="rf-cardlink">
                          <Link
                            to={`/leads/${lead.id}`}
                            viewTransition
                            className="text-sm font-medium text-ink transition-colors duration-(--duration-fast) ease-out hover:text-brand-700"
                          >
                            {lead.contact?.name ?? '—'}
                          </Link>
                        </span>
                        <ScoreDot score={lead.score} band={lead.score_band} />
                        <StageBadge stage={lead.stage} />
                        {lead.last_activity_at !== null && (
                          <span className="ml-auto font-mono text-xs text-muted">
                            {formatRelativeTime(lead.last_activity_at)}
                          </span>
                        )}
                      </div>
                    </Card>
                  </motion.li>
                ))}
              </ul>
            ))}
        </div>
      </div>
    </>
  )
}
