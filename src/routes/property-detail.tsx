import { Link, useParams } from 'react-router'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import { Button, Card, EmptyState, ErrorState, LoadingState, ScoreDot } from '@/components/ui'
import { FactList, RecordHeader, RecordSectionHead } from '@/components/record'
import { LifecycleBadge, OperationBadge, StageBadge } from '@/components/labels'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { listLeads, type Page } from '@/lib/crm/api'
import { listProperties } from '@/lib/crm/properties'
import type { CrmLead } from '@/lib/crm/types'

const EMPTY_LEADS: Page<CrmLead> = { items: [], total: 0 }

export function PropertyDetailPage() {
  const { code } = useParams()
  const { t, formatCurrency, formatNumber, formatDate, formatRelativeTime } = useI18n()
  const reveal = useRowReveal()

  // There is no detail-by-code endpoint yet. `search` is a fuzzy OR across
  // title/city/code (see mock/crm.js and propertyParams' tests), so a wider
  // net than limit:1 is needed — a title that happens to contain an RF-like
  // string could otherwise take the one slot and starve out the real match
  // before the .find() below ever sees it.
  const propertyResource = useResource(
    (signal) => listProperties({ search: code, limit: 5 }, signal),
    [code],
  )
  const property =
    propertyResource.status === 'ready'
      ? propertyResource.data.items.find((item) => item.code === code)
      : undefined

  // Gated on the id being known: without this, first render fires
  // listLeads({ property_id: undefined }) — an unfiltered fetch of every
  // lead — before immediately refetching once the property resolves.
  const leads = useResource(
    (signal) =>
      property === undefined
        ? Promise.resolve(EMPTY_LEADS)
        : listLeads({ property_id: property.id, limit: 50 }, signal),
    [property?.id],
  )

  if (propertyResource.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (propertyResource.status === 'error') {
    return (
      <ErrorState
        message={propertyResource.message}
        retryLabel={t('common.retry')}
        onRetry={propertyResource.reload}
      />
    )
  }

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

  // CrmProperty carries no bedrooms/bathrooms/parking — those live in an EAV
  // table the endpoint does not surface yet (owner decision from Task 5:
  // area-only for 2a). Showing fewer specs beats inventing ones the API
  // never sent.
  const specs = [
    {
      label: t('common.price'),
      value: property.price === null ? '—' : formatCurrency(property.price),
      numeric: true,
    },
    {
      label: t('common.area'),
      value: property.area === null ? '—' : `${formatNumber(property.area)} m²`,
      numeric: true,
    },
    { label: t('common.city'), value: property.city ?? '—' },
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
            {property.featured_expires_at !== null && (
              <span className="font-mono text-xs text-muted">
                {t('properties.featuredUntil', {
                  date: formatDate(property.featured_expires_at),
                })}
              </span>
            )}
          </>
        }
      />

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
