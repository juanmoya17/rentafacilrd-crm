import { useRef, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { motion } from 'motion/react'
import {
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  CreditCard,
  KanbanSquare,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react'
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
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  badge?: number
}

/**
 * Icons are navigational, not decorative: an agent in this tool all day
 * reaches for a shape before a word, and the sections are short enough that a
 * distinct silhouette per item is achievable — which is the only condition
 * under which nav icons earn their space. Each label stays visible beside its
 * icon; an icon-only rail would trade a learnable list for a guessing game.
 */
const SECTIONS: { title: TranslationKey; items: NavItem[] }[] = [
  {
    title: 'nav.section.crm',
    items: [
      { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/pipeline', label: 'nav.pipeline', icon: KanbanSquare },
      { to: '/leads', label: 'nav.leads', icon: Users },
      { to: '/tasks', label: 'nav.tasks', icon: CalendarCheck },
    ],
  },
  {
    title: 'nav.section.inventory',
    items: [
      { to: '/properties', label: 'nav.properties', icon: Building2 },
      { to: '/projects', label: 'nav.projects', icon: Layers },
      { to: '/inventory', label: 'nav.units', icon: Boxes },
    ],
  },
  {
    title: 'nav.section.system',
    items: [
      {
        to: '/notifications',
        label: 'nav.notifications',
        icon: Bell,
        badge: NOTIFICATIONS.filter((item) => !item.read).length,
      },
      { to: '/plan', label: 'nav.plan', icon: CreditCard },
      { to: '/settings', label: 'nav.settings', icon: Settings },
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
            className="-ml-1 rounded-md p-2 text-ink-2 transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken active:translate-y-px lg:hidden"
          >
            {/* The glyph swaps to an × while the menu is open — a hamburger
                that stays a hamburger over an open panel gives the user no
                clue that pressing it again is what closes it. */}
            {menuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>

          {/* The mark is artwork and keeps its own teal (#04AC9C); every UI
              surface stays on the brand token. `alt=""` because the wordmark
              beside it already names the product — a screen reader hearing
              "RentaFácil CRM logo, RentaFácil CRM" is being told twice. */}
          <img src="/logo.svg" alt="" className="size-7 shrink-0 sm:size-8" />

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
            {/* Icon + label above sm, icon-only below — the label is the first
                thing worth dropping when the header runs out of room, and an
                icon-only control still carries its name via aria-label. */}
            <Button
              state={signingOut ? 'loading' : 'idle'}
              onClick={() => void handleSignOut()}
              aria-label={t('auth.signOut')}
            >
              {!signingOut && <LogOut className="size-4" aria-hidden="true" />}
              <span className="hidden sm:inline">
                {signingOut ? t('auth.signingOut') : t('auth.signOut')}
              </span>
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
                            <span className="relative flex min-w-0 items-center gap-2.5">
                              {/* strokeWidth rises on the active item rather
                                  than the icon swapping to a filled variant:
                                  weight is how this system carries hierarchy
                                  everywhere else, and half the set has no
                                  filled twin to swap to. */}
                              <item.icon
                                className={`size-4 shrink-0 ${
                                  isActive ? 'text-brand-700' : 'text-muted'
                                }`}
                                strokeWidth={isActive ? 2.25 : 1.75}
                                aria-hidden="true"
                              />
                              <span className="truncate">{t(item.label)}</span>
                            </span>
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
