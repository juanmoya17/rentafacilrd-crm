import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import {
  categoryOf,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotification,
  type NotificationCategory,
} from '@/lib/crm/notifications'
import { decrementUnread, refreshUnreadCount, setUnreadCount } from '@/lib/crm/unread-store'

/**
 * One page, not an infinite list. `get_notification_list` pages by
 * offset/limit and reports `total`, so the screen says how many it is showing
 * out of how many exist instead of ending in a silent cut — the same rule the
 * project units table follows.
 */
const PAGE_SIZE = 20

const CATEGORY_LABEL: Record<NotificationCategory, TranslationKey> = {
  chat: 'notifications.category.chat',
  property: 'notifications.category.property',
  lead: 'notifications.category.lead',
  saved_search: 'notifications.category.saved_search',
  favourite: 'notifications.category.favourite',
  review_request: 'notifications.category.review_request',
  review_received: 'notifications.category.review_received',
  payment: 'notifications.category.payment',
  subscription: 'notifications.category.subscription',
  reengagement: 'notifications.category.reengagement',
  advertisement: 'notifications.category.advertisement',
  advertisement_request: 'notifications.category.advertisement_request',
  meeting: 'notifications.category.meeting',
  property_inquiry: 'notifications.category.property_inquiry',
  project_inquiry: 'notifications.category.project_inquiry',
  verification: 'notifications.category.verification',
  general: 'notifications.category.general',
}

function NotificationRow({
  item,
  index,
  onRead,
}: {
  item: InboxNotification
  index: number
  onRead: (id: number) => void
}) {
  const { t, formatRelativeTime } = useI18n()
  const reveal = useRowReveal()

  return (
    <motion.li {...reveal(index)}>
      {/* Unread carries an accent spine rather than a tinted fill:
          a whole coloured card competes with the badges inside it. */}
      <Card
        className={`p-3 transition-colors duration-(--duration-base) ease-out hover:border-rule-2 ${
          item.is_read ? '' : 'border-l-2 border-l-accent bg-brand-50/40'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <Badge tone={item.is_read ? 'neutral' : 'brand'}>
            {t(CATEGORY_LABEL[categoryOf(item)])}
          </Badge>
          {item.created_at !== '' ? (
            <time dateTime={item.created_at} className="font-mono text-xs text-muted">
              {formatRelativeTime(item.created_at)}
            </time>
          ) : null}
        </div>
        <p className="mt-2 text-sm font-medium text-ink">{item.title}</p>
        <p className="mt-0.5 text-sm text-ink-2">{item.message}</p>
        {item.is_read ? null : (
          <div className="mt-2">
            <Button
              variant="secondary"
              onClick={() => {
                onRead(item.id)
              }}
            >
              {t('notifications.markRead')}
            </Button>
          </div>
        )}
      </Card>
    </motion.li>
  )
}

export function NotificationsPage() {
  const { t } = useI18n()
  const inbox = useResource((signal) => fetchNotifications({ limit: PAGE_SIZE }, signal), [])

  // Local read state layered on the fetched page: marking read must not
  // refetch the whole list, which would reorder nothing but flash every row.
  const [readIds, setReadIds] = useState<Set<number>>(new Set())
  const [markingAll, setMarkingAll] = useState(false)

  // The badge and this screen share one count. Seeding it from the page keeps
  // them agreeing on first paint; the refresh covers the rows past PAGE_SIZE
  // that this page never saw.
  useEffect(() => {
    const controller = new AbortController()
    refreshUnreadCount(controller.signal)
    return () => {
      controller.abort()
    }
  }, [])

  if (inbox.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (inbox.status === 'error') {
    return <ErrorState message={inbox.message} retryLabel={t('common.retry')} onRetry={inbox.reload} />
  }

  const items = inbox.data.items.map((item) =>
    readIds.has(item.id) ? { ...item, is_read: true } : item,
  )
  const unread = items.filter((item) => !item.is_read).length

  const markOne = (id: number): void => {
    // Optimistic: the row greys out now and the store drops by one. A failure
    // puts it back rather than leaving a row that claims to be read and is not.
    setReadIds((current) => new Set(current).add(id))
    decrementUnread()
    markNotificationRead(id).catch(() => {
      setReadIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      refreshUnreadCount()
    })
  }

  const markAll = (): void => {
    setMarkingAll(true)
    markAllNotificationsRead()
      .then(() => {
        // Every visible row, and the badge to zero: the endpoint marks EVERY
        // visible notification, including the ones past this page.
        setReadIds(new Set(items.map((item) => item.id)))
        setUnreadCount(0)
      })
      .catch(() => {
        refreshUnreadCount()
      })
      .finally(() => {
        setMarkingAll(false)
      })
  }

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        subtitle={unread > 0 ? t('common.resultCount', { count: unread }) : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {items.length === 0 ? (
            <EmptyState title={t('notifications.empty')} />
          ) : (
            <>
              {unread > 0 ? (
                <div className="mb-3">
                  <Button variant="secondary" disabled={markingAll} onClick={markAll}>
                    {t('notifications.markAllRead')}
                  </Button>
                </div>
              ) : null}

              <ul className="space-y-2">
                {items.map((item, index) => (
                  <NotificationRow key={item.id} item={item} index={index} onRead={markOne} />
                ))}
              </ul>

              {/* Says what it is showing instead of looking complete. */}
              {inbox.data.total > items.length ? (
                <p className="mt-3 text-xs text-muted">
                  {t('notifications.showingOf', { shown: items.length, total: inbox.data.total })}
                </p>
              ) : null}
            </>
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
