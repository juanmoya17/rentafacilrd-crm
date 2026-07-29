import { useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { useScrollRestoration } from '@/lib/use-scroll-restoration'
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

  const scrollRef = useRef<HTMLElement>(null)
  useScrollRestoration(scrollRef)

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
    /* The shell is a grid, not a stack of sticky boxes with hardcoded offsets.
       The previous version pinned the sidebar and the table head at `top-49px`
       — a constant measured against an older header. Raising the control height
       to 36px made the real header 57px, and every sticky element sat 8px too
       high with a strip of content showing through underneath. A grid row of
       `auto` cannot drift. */
    /* grid-cols-[minmax(0,1fr)] is not decoration. A grid item's automatic
       minimum size in the inline axis is min-content, so the Kanban's
       `min-w-max` propagated all the way up and stretched the shell to 1644px
       on a 1280px viewport — which pushed the header's sign-out button to
       x=1852, off-screen. `overflow-x: clip` on html/body then hid the
       scrollbar, so the page looked fine while the header was unusable. */
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-surface">
      {/* vt-* names split the shell into its own view-transition groups, so a
          route change moves only <main> — without them the browser cross-fades
          the sidebar and header too, and identical chrome visibly blinks. */}
      <header className="vt-header z-20 border-b border-rule bg-surface-raised">
        <div className="flex min-w-0 items-center gap-2 px-4 py-2.5 sm:gap-3">
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
          {/* nowrap + min-w-0 on the row: at 375px this was breaking onto two
              lines and dragging the whole header taller. */}
          <span className="truncate whitespace-nowrap font-mono text-sm font-semibold tracking-tight text-brand-700 sm:text-base">
            {t('app.name')}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {user && <span className="hidden text-sm text-muted sm:inline">{user.name}</span>}
            <LanguageSwitcher />
            <Button state={signingOut ? 'loading' : 'idle'} onClick={() => void handleSignOut()}>
              {signingOut ? t('auth.signingOut') : t('auth.signOut')}
            </Button>
          </div>
        </div>

        {signOutError && (
          <p role="alert" className="bg-warning-bg px-4 py-2 text-sm text-warning">
            {signOutError}
          </p>
        )}
      </header>

      {/* min-h-0 on both this row and each pane is what actually constrains
          them — without it they size to content and the whole page scrolls as
          one again, which is how the sticky table head ends up doing nothing.
          Column on mobile so the open menu sits above the content; row on lg. */}
      <div className="flex min-h-0 min-w-0 flex-col lg:flex-row">
        <aside
          className={`${
            menuOpen ? 'block' : 'hidden'
          } vt-sidebar min-h-0 shrink-0 overflow-y-auto border-b border-rule bg-surface-raised px-3 py-4 lg:block lg:w-56 lg:border-r lg:border-b-0`}
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
                        viewTransition
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          `relative flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors duration-(--duration-fast) ease-out ${
                            isActive
                              ? 'font-medium text-brand-700'
                              : 'text-ink-2 hover:bg-surface-sunken'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* One indicator for the whole nav, so it travels
                                from the old item to the new one instead of
                                blinking out here and in over there. */}
                            {isActive && (
                              <motion.span
                                layoutId="nav-active"
                                aria-hidden="true"
                                className="absolute inset-0 rounded-md bg-brand-50"
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                              />
                            )}
                            <span className="relative">{t(item.label)}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="relative rounded-full bg-accent px-1.5 font-mono text-xs font-semibold text-accent-ink">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* main is now its own scroll container, which is what lets a Register's
            `sticky top-0` table head pin under the app bar with no offset to
            keep in sync. min-w-0 still keeps wide tables and the Kanban
            scrolling inside themselves rather than widening the page. */}
        {/* The padding lives on the inner wrapper, not on <main>. Sticky offsets
            resolve against the scrollport's content box, so padding on <main>
            itself parks a `sticky top-0` table head 20px down and lets rows
            scroll through the gap above it. */}
        {/* The remount key sits on the inner wrapper, NOT on <main>. A keyed
            scroll container is destroyed and rebuilt on every navigation, so
            there is no element left to restore a scroll position into — and
            `scrollTop` on a brand-new node is always 0. Keeping <main> stable
            is what makes useScrollRestoration possible at all. */}
        <main ref={scrollRef} className="vt-main min-h-0 min-w-0 flex-1 overflow-y-auto">
          {/* min-w-0 again here: without it the Kanban's min-w-max stretches
              this wrapper, and every screen's toolbar goes with it. */}
          <div key={location.pathname} className="min-w-0 px-4 py-5 lg:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
