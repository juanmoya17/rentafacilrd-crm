import { Link, useParams } from 'react-router'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import { Button, Card, EmptyState, ErrorState, LoadingState, ScoreDot } from '@/components/ui'
import { FactGrid, RecordHeader, RecordSectionHead } from '@/components/record'
import { PropertyGallery } from '@/components/property-gallery'
import { LifecycleBadge, OperationBadge, StageBadge } from '@/components/labels'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { listLeads, type Page } from '@/lib/crm/api'
import { formatSpecs, listProperties } from '@/lib/crm/properties'
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

  // Two labelled groups rather than one list: the specs are what an agent
  // reads out on the phone, the listing facts are what they check before
  // acting on it. Splitting them is what let the record go full-width — the
  // old single rail sat in a 1/3 column and could only hold five facts.
  //
  // No parking figure — not a parameter in this installation (owner decision
  // from Task 5). Every field renders '—' for a null value rather than
  // inventing a zero, same discipline the list row's formatSpecs() uses.
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
    {
      label: t('common.bedrooms'),
      value: property.bedrooms === null ? '—' : formatNumber(property.bedrooms),
      numeric: true,
    },
    {
      label: t('common.bathrooms'),
      value: property.bathrooms === null ? '—' : formatNumber(property.bathrooms),
      numeric: true,
    },
  ]

  const listing = [
    { label: t('common.city'), value: property.city ?? '—' },
    { label: t('common.code'), value: property.code, numeric: true },
    {
      label: t('common.created'),
      value: property.created_at === null ? '—' : formatDate(property.created_at),
      numeric: true,
    },
    {
      label: t('propertyDetail.moderation'),
      // Null means "not yet derived" (types.ts) — a dash, never a default
      // status, for the same reason the badges render nothing for it.
      value: property.moderation === null ? '—' : t(`moderation.${property.moderation}`),
    },
    {
      label: t('propertyDetail.featured'),
      value:
        property.featured_expires_at === null ? '—' : formatDate(property.featured_expires_at),
      numeric: true,
    },
    {
      label: t('common.leads'),
      value: formatNumber(property.leads_count),
      numeric: true,
    },
  ]

  return (
    <>
      <RecordHeader
        backTo="/properties"
        title={property.title}
        subtitle={property.code}
        media={<PropertyGallery images={property.images} />}
        meta={
          // The glanceable line — what an agent reads out on the phone. The
          // Details grid below carries the same figures labelled and exact;
          // this one is for the two seconds before that.
          <p className="font-mono text-sm text-ink-2">
            {formatSpecs(property, formatNumber)}
            {property.city !== null && <span className="text-muted"> · {property.city}</span>}
          </p>
        }
        badges={
          <>
            <LifecycleBadge lifecycle={property.lifecycle} />
            <OperationBadge operation={property.operation} />
          </>
        }
      />

      {/* Stacked labelled sections, each full-width. The featured date used to
          sit in the badge row above; it is a labelled fact in Publicación now,
          and repeating it in both places would be the same value twice. */}
      <div className="space-y-5">
        {/* Hidden rather than emptied when there is no copy: a labelled
            section holding a dash tells the agent the field exists and is
            blank, which on a draft they are mid-way through writing is noise
            they cannot act on from here. */}
        {property.description !== null && (
          <section>
            <RecordSectionHead label={t('propertyDetail.about')} />
            <Card className="p-4">
              {/* max-w on the measure, not the card: 150-character lines are
                  unreadable, but the card still aligns with the grids below. */}
              <p className="max-w-[70ch] text-sm leading-relaxed text-ink-2">
                {property.description}
              </p>
            </Card>
          </section>
        )}

        <section>
          <RecordSectionHead label={t('propertyDetail.specs')} />
          <Card className="p-4">
            <FactGrid facts={specs} />
          </Card>
        </section>

        <section>
          <RecordSectionHead label={t('propertyDetail.listing')} />
          <Card className="p-4">
            <FactGrid facts={listing} />
          </Card>
        </section>

        <section>
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
        </section>
      </div>
    </>
  )
}
