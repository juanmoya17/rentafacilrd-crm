import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { Badge, Card, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { useRowReveal } from '@/lib/motion'
import { NOTIFICATIONS, type NotificationItem } from '@/lib/mock/data'

const TYPE_LABEL: Record<NotificationItem['type'], TranslationKey> = {
  featured_expiring: 'notifications.typeFeatured',
  price_drop: 'notifications.typePriceDrop',
  lead_created: 'notifications.typeLead',
  sla_breached: 'notifications.typeSla',
}

const CHANNELS: TranslationKey[] = [
  'notifications.channelPush',
  'notifications.channelEmail',
  'notifications.channelInApp',
]

export function NotificationsPage() {
  const { t, formatRelativeTime } = useI18n()
  const reveal = useRowReveal()
  const unread = NOTIFICATIONS.filter((item) => !item.read).length

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        subtitle={unread > 0 ? t('common.resultCount', { count: unread }) : undefined}
      />
      <MockNotice>{t('mock.notice', { milestone: 'B.2 / B.3' })}</MockNotice>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {NOTIFICATIONS.length === 0 ? (
            <EmptyState title={t('notifications.empty')} />
          ) : (
            <ul className="space-y-2">
              {NOTIFICATIONS.map((item, index) => (
                <motion.li key={item.id} {...reveal(index)}>
                  {/* Unread carries an accent spine rather than a tinted fill:
                      a whole coloured card competes with the badges inside it. */}
                  <Card
                    className={`p-3 transition-colors duration-(--duration-base) ease-out hover:border-rule-2 ${
                      item.read
                        ? ''
                        : 'border-l-2 border-l-accent bg-brand-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={item.read ? 'neutral' : 'brand'}>
                        {t(TYPE_LABEL[item.type])}
                      </Badge>
                      <time dateTime={item.at} className="font-mono text-xs text-muted">
                        {formatRelativeTime(item.at)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 text-sm text-ink-2">{item.body}</p>
                  </Card>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        {/* B.3 — channel and opt-in per event type. */}
        {/* top-0, not a measured offset: <main> is the scrollport, so there is
            no header height to subtract — the same trap that had the sidebar
            8px out of alignment. */}
        <Card className="h-fit p-4 lg:sticky lg:top-0">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            {t('notifications.preferences')}
          </h2>
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th scope="col" className="pb-2 font-medium">
                  {t('common.status')}
                </th>
                {CHANNELS.map((channel) => (
                  <th key={channel} scope="col" className="px-2 pb-2 text-center font-medium">
                    {t(channel)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.values(TYPE_LABEL).map((label) => (
                <tr key={label} className="border-t border-rule">
                  <th scope="row" className="py-2 pr-2 text-left font-normal text-ink-2">
                    {t(label)}
                  </th>
                  {CHANNELS.map((channel) => (
                    <td key={channel} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        defaultChecked
                        aria-label={`${t(label)} — ${t(channel)}`}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}
