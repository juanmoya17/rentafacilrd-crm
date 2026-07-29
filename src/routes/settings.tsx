import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import { Card, PageHeader } from '@/components/ui'
import { LanguageSwitcher } from '@/components/language-switcher'

export function SettingsPage() {
  const { state } = useAuth()
  const { t } = useI18n()
  if (state.status !== 'authenticated') return null

  return (
    <>
      <PageHeader title={t('settings.title')} />

      <div className="grid max-w-2xl gap-4">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{t('settings.profile')}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{t('settings.name')}</dt>
              <dd className="font-medium text-slate-900">{state.user.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{t('auth.email')}</dt>
              <dd className="font-medium text-slate-900">{state.user.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">{t('settings.agentId')}</dt>
              <dd className="tabular-nums font-medium text-slate-900">{state.user.id}</dd>
            </div>
          </dl>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t('settings.language')}</h2>
          <LanguageSwitcher />
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">{t('settings.session')}</h2>
          <p className="text-sm text-slate-600">{t('settings.sessionNote')}</p>
        </Card>
      </div>
    </>
  )
}
