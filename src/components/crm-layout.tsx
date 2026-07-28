import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { LanguageSwitcher } from '@/components/language-switcher'

const NAV: { to: string; label: TranslationKey }[] = [{ to: '/', label: 'nav.home' }]

export function CrmLayout() {
  const { state, logout } = useAuth()
  const t = useT()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const user = state.status === 'authenticated' ? state.user : null

  const handleSignOut = async () => {
    setSigningOut(true)
    setSignOutError(null)
    try {
      await logout()
    } catch (error: unknown) {
      // The local session is already cleared by logout(), so RequireAuth is
      // redirecting regardless. This only reports that the server never heard.
      setSignOutError(error instanceof Error ? error.message : t('auth.signOutFailed'))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold text-slate-900">{t('app.name')}</span>

          <nav aria-label={t('nav.main')} className="flex gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
            )}
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {signingOut ? t('auth.signingOut') : t('auth.signOut')}
            </button>
          </div>
        </div>

        {signOutError && (
          <p role="alert" className="bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {signOutError}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
