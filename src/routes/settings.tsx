import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import { Button, Card, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { FactList, RecordSectionHead } from '@/components/record'
import { Register, type Column } from '@/components/register'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useRowReveal } from '@/lib/motion'
import { useToast } from '@/lib/toast-context'
import { useResource } from '@/lib/use-resource'
import {
  NOTIFICATION_EVENT_TYPES,
  getNotificationPreferences,
  resetNotificationPreferences,
  resolvePreference,
  setNotificationPreference,
  type NotificationChannel,
  type NotificationDefaults,
  type NotificationEventType,
  type NotificationPreference,
} from '@/lib/crm/notifications'

export function SettingsPage() {
  const { state } = useAuth()
  const { t } = useI18n()
  const reveal = useRowReveal()
  if (state.status !== 'authenticated') return null

  const profile = [
    { label: t('settings.name'), value: state.user.name },
    { label: t('auth.email'), value: state.user.email },
    { label: t('settings.agentId'), value: String(state.user.id), numeric: true },
  ]

  return (
    <>
      <PageHeader title={t('settings.title')} />

      {/* Preferences is the one family with no data density to serve, so it is
          the one place the measure is held to reading width rather than filled. */}
      <div className="grid max-w-2xl gap-6">
        <motion.section {...reveal(0)}>
          <RecordSectionHead label={t('settings.profile')} />
          <Card className="p-4">
            <FactList facts={profile} />
          </Card>
        </motion.section>

        <motion.section {...reveal(1)}>
          <RecordSectionHead label={t('settings.language')} />
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted">{t('language.label')}</p>
            <LanguageSwitcher />
          </Card>
        </motion.section>

        <motion.section {...reveal(2)}>
          <RecordSectionHead label={t('settings.notifications')} />
          <NotificationPreferencesSection />
        </motion.section>

        <motion.section {...reveal(3)}>
          <RecordSectionHead label={t('settings.session')} />
          <Card className="p-4">
            <p className="max-w-prose text-sm text-ink-2">{t('settings.sessionNote')}</p>
          </Card>
        </motion.section>
      </div>
    </>
  )
}

/**
 * Five event types × two channels (push/email — there is no in-app
 * preference to configure, see lib/crm/notifications.ts). Reads as a table,
 * so it gets the Register/Column shell the rest of the app uses for one —
 * that is also what gives it the mobile card layout for free.
 *
 * Optimistic like pipeline.tsx / lead-detail.tsx: a toggle flips immediately
 * and only snaps back if the server refuses, reported through the failure
 * toast. No success toast — the checkbox moving is the receipt.
 */
function NotificationPreferencesSection() {
  const { t } = useI18n()
  const toast = useToast()
  const resource = useResource((signal) => getNotificationPreferences(signal), [])

  const [defaults, setDefaults] = useState<NotificationDefaults | null>(null)
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [resetting, setResetting] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const loaded = resource.status === 'ready' ? resource.data : null
  useEffect(() => {
    if (loaded !== null) {
      setDefaults(loaded.defaults)
      setPreferences(loaded.preferences)
    }
  }, [loaded])

  const toggle = async (
    eventType: NotificationEventType,
    channel: NotificationChannel,
    wasEnabled: boolean,
  ) => {
    if (defaults === null) return
    const key = `${eventType}:${channel}`
    const nextEnabled = !wasEnabled
    const baseline = defaults[eventType][channel]

    setPreferences((current) => withPreference(current, eventType, channel, nextEnabled, baseline))
    setPending((current) => new Set(current).add(key))

    try {
      // The write echoes the full refreshed snapshot — adopt it instead of
      // re-deriving locally, same as pipeline.tsx / lead-detail.tsx adopting
      // the server's returned object. Less local state that can drift.
      const updated = await setNotificationPreference(eventType, channel, nextEnabled)
      setDefaults(updated.defaults)
      setPreferences(updated.preferences)
    } catch (error: unknown) {
      // The checkbox has already flipped, which on its own reads as the
      // control just not working. The toast is what makes the rollback
      // legible, and it carries the retry.
      setPreferences((current) => withPreference(current, eventType, channel, wasEnabled, baseline))
      toast.fail(error instanceof Error ? error.message : t('notifications.pref.saveFailed'), {
        label: t('common.retry'),
        run: () => void toggle(eventType, channel, wasEnabled),
      })
    } finally {
      setPending((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  const reset = async () => {
    const previous = preferences
    setConfirmingReset(false)
    setResetting(true)
    setPreferences([])

    try {
      const updated = await resetNotificationPreferences()
      setDefaults(updated.defaults)
      setPreferences(updated.preferences)
    } catch (error: unknown) {
      setPreferences(previous)
      toast.fail(error instanceof Error ? error.message : t('notifications.pref.resetFailed'), {
        label: t('common.retry'),
        run: () => void reset(),
      })
    } finally {
      setResetting(false)
    }
  }

  if (resource.status === 'loading') return <LoadingState label={t('common.loading')} />

  if (resource.status === 'error') {
    return (
      <ErrorState message={resource.message} retryLabel={t('common.retry')} onRetry={resource.reload} />
    )
  }

  if (defaults === null) return null

  const channelColumn = (channel: NotificationChannel): Column<NotificationEventType> => ({
    key: channel,
    header: t(channel === 'push' ? 'notifications.channelPush' : 'notifications.channelEmail'),
    render: (eventType) => {
      const enabled = resolvePreference(defaults, preferences, eventType, channel)
      return (
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending.has(`${eventType}:${channel}`)}
          onChange={() => void toggle(eventType, channel, enabled)}
          aria-label={`${t(`notifications.eventType.${eventType}`)} — ${t(
            channel === 'push' ? 'notifications.channelPush' : 'notifications.channelEmail',
          )}`}
          className="size-4 accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55"
        />
      )
    },
  })

  const columns: Column<NotificationEventType>[] = [
    {
      key: 'eventType',
      header: t('notifications.pref.eventType'),
      card: 'primary',
      render: (eventType) => t(`notifications.eventType.${eventType}`),
    },
    channelColumn('push'),
    channelColumn('email'),
  ]

  return (
    <>
      <Register
        columns={columns}
        rows={NOTIFICATION_EVENT_TYPES}
        rowKey={(eventType) => eventType}
        label={t('notifications.preferences')}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirmingReset ? (
          <>
            <span className="text-sm text-ink-2">{t('notifications.pref.resetConfirm')}</span>
            <Button
              variant="primary"
              disabled={resetting}
              state={resetting ? 'loading' : 'idle'}
              onClick={() => void reset()}
            >
              {t('bulk.confirm')}
            </Button>
            <Button disabled={resetting} onClick={() => setConfirmingReset(false)}>
              {t('bulk.cancel')}
            </Button>
          </>
        ) : (
          <Button onClick={() => setConfirmingReset(true)}>{t('notifications.pref.reset')}</Button>
        )}
      </div>
    </>
  )
}

/**
 * Mirrors the server's delete-on-default rule (mock/crm.js and the real API
 * agree on this): a value that lands back on the resolved baseline is
 * dropped from the list rather than stored as an explicit row. Applying the
 * same rule to the optimistic local copy is what keeps "toggle off, toggle
 * back on" settle at zero stored rows instead of one that merely matches
 * the default.
 */
function withPreference(
  preferences: NotificationPreference[],
  eventType: NotificationEventType,
  channel: NotificationChannel,
  enabled: boolean,
  baseline: boolean,
): NotificationPreference[] {
  const withoutThis = preferences.filter(
    (preference) => !(preference.event_type === eventType && preference.channel === channel),
  )
  return enabled === baseline ? withoutThis : [...withoutThis, { event_type: eventType, channel, enabled }]
}
