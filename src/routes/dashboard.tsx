import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n/context'

export function DashboardPage() {
  const { state } = useAuth()
  const t = useT()
  if (state.status !== 'authenticated') return null

  return (
    <section>
      <h1 className="text-xl font-semibold text-slate-900">
        {t('dashboard.greeting', { name: state.user.name })}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{t('dashboard.sessionNote')}</p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            {t('dashboard.email')}
          </dt>
          <dd className="mt-1 text-sm text-slate-900">{state.user.email}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            {t('dashboard.agentId')}
          </dt>
          <dd className="mt-1 text-sm text-slate-900">{state.user.id}</dd>
        </div>
      </dl>
    </section>
  )
}
