import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/components/language-switcher'

/**
 * Shown to a signed-in customer who is not a verified agent.
 *
 * Not a dead end and not an accusation: their listings and leads keep working,
 * the leads accrue server-side against propertys.added_by, and they appear here
 * the day verification is approved. The screen says so, because the alternative
 * is someone assuming the CRM lost their pipeline.
 */
export function VerificationPending() {
  const { state, logout } = useAuth()
  const t = useT()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = state.status === 'authenticated' ? state.user.name : ''

  const handleSignOut = async () => {
    setSigningOut(true)
    setError(null)
    try {
      await logout()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('auth.signOutFailed'))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-surface-raised p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="font-semibold tracking-tight text-brand-700">{t('app.name')}</span>
          <LanguageSwitcher />
        </div>

        <h1 className="mt-6 text-lg font-semibold text-slate-900">
          {t('verification.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t('verification.body', { name })}
        </p>

        <p className="mt-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {t('verification.leadsSafe')}
        </p>

        <h2 className="mt-5 text-sm font-medium text-slate-900">
          {t('verification.howTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t('verification.how')}</p>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="mt-6 w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {signingOut ? t('auth.signingOut') : t('auth.signOut')}
        </button>
      </div>
    </div>
  )
}
