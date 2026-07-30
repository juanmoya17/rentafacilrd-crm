import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { railBucketTarget } from '@/lib/crm/properties'
import type { ActionRail as ActionRailData, RailBucketKey } from '@/lib/crm/types'

/**
 * A.6 — "Requiere acción". Four shortcuts from two sources, same idiom as
 * `Segmented`'s chips: a bordered pill per bucket, count in mono, count and
 * label both inside one link so the whole chip is the tap target.
 *
 * Three labels reuse the dashboard's existing copy — they name the exact same
 * thing (a rejected listing is a rejected listing, whichever screen says so).
 * Only `overdue_tasks` has no prior copy to reuse.
 */
const BUCKET_LABEL: Record<RailBucketKey, TranslationKey> = {
  rejected: 'dashboard.rejected',
  expiring_featured: 'dashboard.featuredExpiring',
  sla_breached: 'dashboard.slaBreached',
  overdue_tasks: 'rail.overdueTasks',
}

/**
 * Renders nothing at all when `total === 0` — no container, no heading, no
 * placeholder. Zero noise is the feature: a rail that shows up to say
 * "nothing pending" is exactly the noise A.6 exists to remove.
 */
export function ActionRail({ rail }: { rail: ActionRailData }) {
  const { t, formatNumber } = useI18n()

  if (rail.total === 0) return null

  return (
    <div className="mb-4">
      {/* Visually obvious from the chips themselves (a count + a label each) —
          the heading exists for assistive tech only. */}
      <h2 className="sr-only">{t('dashboard.needsAction')}</h2>
      <ul className="flex flex-wrap gap-2">
        {rail.buckets.map((bucket) => (
          <li key={bucket.key}>
            <Link
              to={railBucketTarget(bucket.key)}
              viewTransition
              className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-rule bg-surface-raised px-2.5 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-(--duration-fast) ease-out hover:border-rule-2 hover:bg-surface-sunken active:translate-y-px"
            >
              <span className="font-mono text-sm font-semibold text-warning">
                {formatNumber(bucket.count)}
              </span>
              {t(BUCKET_LABEL[bucket.key])}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
