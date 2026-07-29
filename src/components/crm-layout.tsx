import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui'
import { NOTIFICATIONS } from '@/lib/mock/data'

interface NavItem {
  to: string
  label: TranslationKey
  badge?: number
}

const SECTIONS: { title: TranslationKey; items: NavItem[] }[] = [
  {
    title: 'nav.section.crm',
    items: [
      { to: '/', label: 'nav.dashboard' },
      { to: '/pipeline', label: 'nav.pipeline' },
      { to: '/leads', label: 'nav.leads' },
      { to: '/tasks', label: 'nav.tasks' },
    ],
  },
  {
    title: 'nav.section.inventory',
    items: [
      { to: '/properties', label: 'nav.properties' },
      { to: '/projects', label: 'nav.projects' },
      { to: '/inventory', label: 'nav.units' },
    ],
  },
  {
    title: 'nav.section.system',
    items: [
      {
        to: '/notifications',
        label: 'nav.notifications',
        badge: NOTIFICATIONS.filter((item) => !item.read).length,
      },
      { to: '/settings', label: 'nav.settings' },
    ],
  },
]

export function CrmLayout() {
  const { state, logout } = useAuth()
  const t = useT()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
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
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-20 border-b border-rule bg-surface-raised">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            aria-label={t('nav.toggle')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md p-1.5 text-ink-2 hover:bg-surface-sunken lg:hidden"
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true" fill="currentColor">
              <path d="M3 5h14v1.5H3V5Zm0 4.25h14v1.5H3v-1.5ZM3 13.5h14V15H3v-1.5Z" />
            </svg>
          </button>

          {/* Mono is the outlier face, and the wordmark is one of its two
              sanctioned slots — it gives the chrome a different register from
              the data without adding a third family. */}
          <span className="font-mono font-semibold tracking-tight text-brand-700">
            {t('app.name')}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {user && <span className="hidden text-sm text-muted sm:inline">{user.name}</span>}
            <LanguageSwitcher />
            <Button state={signingOut ? 'loading' : 'idle'} onClick={() => void handleSignOut()}>
              {signingOut ? t('auth.signingOut') : t('auth.signOut')}
            </Button>
          </div>
        </div>

        {signOutError && (
          <p role="alert" className="bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {signOutError}
          </p>
        )}
      </header>

      <div className="flex">
        <aside
          className={`${
            menuOpen ? 'block' : 'hidden'
          } w-full shrink-0 border-b border-rule bg-surface-raised px-3 py-4 lg:sticky lg:top-[49px] lg:block lg:h-[calc(100dvh-49px)] lg:w-56 lg:border-r lg:border-b-0`}
        >
          <nav aria-label={t('nav.main')} className="space-y-5">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                {/* `muted`, not a lighter step: these labels used to sit at
                    slate-400, which is 2.6:1 on white. */}
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  {t(section.title)}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                            isActive
                              ? 'bg-brand-50 font-medium text-brand-700'
                              : 'text-ink-2 hover:bg-surface-sunken'
                          }`
                        }
                      >
                        {t(item.label)}
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="rounded-full bg-accent px-1.5 font-mono text-xs font-semibold text-accent-ink">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* min-w-0 so wide tables and the Kanban scroll inside, never the page. */}
        <main key={location.pathname} className="min-w-0 flex-1 px-4 py-5 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
