import { useI18n } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { Badge, Card, EmptyState, MockNotice, PageHeader } from '@/components/ui'
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

  return (
    <>
      <PageHeader title={t('notifications.title')} />
      <MockNotice>{t('mock.notice', { milestone: 'B.2 / B.3' })}</MockNotice>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {NOTIFICATIONS.length === 0 ? (
            <EmptyState title={t('notifications.empty')} />
          ) : (
            <ul className="space-y-2">
              {NOTIFICATIONS.map((item) => (
                <li key={item.id}>
                  <Card className={`p-3 ${item.read ? '' : 'border-brand-200 bg-brand-50/40'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={item.read ? 'neutral' : 'brand'}>
                        {t(TYPE_LABEL[item.type])}
                      </Badge>
                      <time dateTime={item.at} className="text-xs tabular-nums text-slate-400">
                        {formatRelativeTime(item.at)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{item.body}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* B.3 — channel and opt-in per event type. */}
        <Card className="h-fit p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            {t('notifications.preferences')}
          </h2>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th scope="col" className="pb-2 font-medium">{t('common.status')}</th>
                {CHANNELS.map((channel) => (
                  <th key={channel} scope="col" className="px-2 pb-2 text-center font-medium">
                    {t(channel)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.values(TYPE_LABEL).map((label) => (
                <tr key={label}>
                  <th scope="row" className="py-2 pr-2 text-left font-normal text-slate-700">
                    {t(label)}
                  </th>
                  {CHANNELS.map((channel) => (
                    <td key={channel} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        defaultChecked
                        aria-label={`${t(label)} — ${t(channel)}`}
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
