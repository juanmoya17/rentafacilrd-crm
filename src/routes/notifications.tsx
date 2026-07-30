import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { Badge, Button, Card, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { useRowReveal } from '@/lib/motion'
import { NOTIFICATIONS, type NotificationItem } from '@/lib/mock/data'

const TYPE_LABEL: Record<NotificationItem['type'], TranslationKey> = {
  featured_expiring: 'notifications.typeFeatured',
  price_drop: 'notifications.typePriceDrop',
  lead_created: 'notifications.typeLead',
  sla_breached: 'notifications.typeSla',
}

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

        {/* B.3's real matrix now lives on Settings — this card points there
            instead of duplicating it. A second, unwired copy here (the old
            `defaultChecked` placeholder) let an agent toggle something that
            saved nothing, which is worse than no control at all. */}
        {/* top-0, not a measured offset: <main> is the scrollport, so there is
            no header height to subtract — the same trap that had the sidebar
            8px out of alignment. */}
        <Card className="h-fit p-4 lg:sticky lg:top-0">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {t('notifications.preferences')}
          </h2>
          <p className="text-sm text-ink-2">{t('notifications.managePreferences')}</p>
          <Link to="/settings" viewTransition className="mt-3 inline-flex">
            <Button variant="secondary">{t('nav.settings')}</Button>
          </Link>
        </Card>
      </div>
    </>
  )
}
