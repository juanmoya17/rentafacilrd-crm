import { Card } from '@/components/ui'
import { CountUp } from '@/components/count-up'
import { useI18n } from '@/lib/i18n/context'
import type { PropertyFilters } from '@/lib/crm/properties'
import type { PropertySummary } from '@/lib/crm/types'

/**
 * A.5 — four counts, each one a shortcut that filters the list below, plus the
 * featured-credit balance (not a filter, spec decision #4).
 *
 * Presentational only: the screen owns the `summary` fetch and passes it down.
 * Task 6's bulk bar needs the same `featured_balance` and a batch action
 * changes both the rows and these counts — two independent fetches would let
 * the strip and the bulk bar disagree the moment a batch succeeds.
 */
export function KpiStrip({
  summary,
  onPick,
}: {
  summary: PropertySummary
  onPick: (filter: PropertyFilters) => void
}) {
  const { t } = useI18n()

  const cards: { key: string; label: string; value: number; filter: PropertyFilters }[] = [
    { key: 'total', label: t('kpi.total'), value: summary.total, filter: {} },
    {
      key: 'published',
      label: t('kpi.published'),
      value: summary.published,
      filter: { lifecycle: 'published' },
    },
    // new_leads counts leads, not listings — there is no property filter that
    // expresses it, so the shortcut lands on the unfiltered list rather than
    // inventing a param the list endpoint does not accept.
    { key: 'newLeads', label: t('kpi.newLeads'), value: summary.new_leads, filter: {} },
    {
      key: 'expiringFeatured',
      label: t('kpi.expiringFeatured'),
      value: summary.expiring_featured,
      // Not is_featured: that's "has any active ad" with no date bound, which
      // disagreed with this count (a listing expiring in 2 days is one of
      // possibly several featured listings). featured_expiring is the exact
      // predicate the count above uses.
      filter: { featured_expiring: true },
    },
  ]

  return (
    /* 2-up on phones, not 1-up. Five full-width cards at 375px was ~480px of
       chrome — a screen and a half of scrolling before the agent reached the
       list they opened the screen for. Two columns is the widest split that
       still fits "FEATURED EXPIRING" without the label wrapping to three
       lines at 320px. Padding steps down with it, for the same reason. */
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.key}
          className="p-0 transition-colors duration-(--duration-base) ease-out hover:border-rule-2"
        >
          <button
            type="button"
            onClick={() => onPick(card.filter)}
            className="flex w-full flex-col p-3 text-left active:translate-y-px sm:p-4"
          >
            <p className="text-xs uppercase tracking-wider text-muted">{card.label}</p>
            <p className="mt-1">
              <CountUp value={card.value} />
            </p>
          </button>
        </Card>
      ))}

      {/* Not a filter — a balance. Static sunken fill (the four buttons above
          are raised white) and no button semantics, so it reads as a fifth
          number rather than a fifth shortcut. */}
      <div className="rounded-lg border border-rule bg-surface-sunken p-3 sm:p-4">
        <p className="text-xs uppercase tracking-wider text-muted">{t('kpi.featuredBalance')}</p>
        <p className="mt-1">
          {summary.featured_balance.unlimited ? (
            <span className="text-2xl font-semibold text-ink">{t('kpi.unlimited')}</span>
          ) : (
            <CountUp value={summary.featured_balance.total} />
          )}
        </p>
      </div>
    </div>
  )
}
