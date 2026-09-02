import { Suspense, useEffect, useRef, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { motion } from 'motion/react'
import {
  ArrowUpRight,
  Bell,
  BookOpen,
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
} from 'lucide-react'
import { useScrollRestoration } from '@/lib/use-scroll-restoration'
import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button, LoadingState, Modal } from '@/components/ui'
import { refreshUnreadCount, useUnreadCount } from '@/lib/crm/unread-store'

interface NavItem {
  to: string
  label: TranslationKey
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  /**
   * A marker, not a number: the count is live and this list is a module
   * constant evaluated once at import. Holding the value here is what made
   * the old badge freeze at whatever the placeholder array said.
   */
  badge?: 'unread'
  /**
   * A static file under `public/`, not a route — so it has to be a plain
   * anchor. A NavLink would client-route to it, the SPA fallback would answer
   * with index.html, and the agent would land back on the dashboard instead of
   * the document.
   */
  external?: boolean
}

/** Shared by the NavLink and the one external anchor, so the two cannot drift. */
const ITEM_CLASS =
  'relative flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors duration-(--duration-fast) ease-out'
const ITEM_IDLE = 'text-ink-2 hover:bg-surface-sunken'

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
        badge: 'unread',
      },
      { to: '/agency', label: 'nav.agency', icon: Building2 },
      { to: '/plan', label: 'nav.plan', icon: CreditCard },
      { to: '/settings', label: 'nav.settings', icon: Settings },
      { to: '/manual-agente.html', label: 'nav.docs', icon: BookOpen, external: true },
    ],
  },
]

/**
 * The thirteen links, rendered by both the desktop rail and the mobile drawer.
 *
 * One list, two surfaces: two copies would have drifted by the third screen
 * anyone added, and the active state is the part that goes wrong silently.
 *
 * `scope` exists only to keep the layoutId unique. The rail stays mounted
 * (display:none) below lg, so with a shared id Motion would see the drawer's
 * indicator and the hidden rail's as the same element and try to travel
 * between them — across a box that has no layout to travel to.
 */
function NavLinks({
  scope,
  unread,
  onNavigate,
}: {
  scope: 'sidebar' | 'drawer'
  unread: number
  onNavigate: () => void
}) {
  const t = useT()

  return (
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
                    {item.external ? (
                      /* Never carries the active indicator: it opens in
                         another tab, so this nav is never "on" it. */
                      <a
                        href={item.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t(item.label)} — ${t('nav.newTab')}`}
                        onClick={onNavigate}
                        className={`${ITEM_CLASS} ${ITEM_IDLE}`}
                      >
                        <span className="relative flex min-w-0 items-center gap-2.5">
                          <item.icon
                            className="size-4 shrink-0 text-muted"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span className="truncate">{t(item.label)}</span>
                        </span>
                        {/* The one thing that tells this item apart from the
                            ten above it before it is clicked. */}
                        <ArrowUpRight
                          className="size-3.5 shrink-0 text-muted"
                          aria-hidden="true"
                        />
                      </a>
                    ) : (
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      viewTransition
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `${ITEM_CLASS} ${
                          isActive ? 'font-medium text-brand-700' : ITEM_IDLE
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
                              layoutId={`nav-active-${scope}`}
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
                          {item.badge === 'unread' && unread > 0 && (
                            <span className="relative rounded-full bg-accent px-1.5 font-mono text-xs font-semibold text-accent-ink">
                              {unread}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
  )
}

/**
 * The bottom bar. Five slots is the ceiling before targets get too narrow to
 * hit, so this is the four screens an agent opens all day plus the way to the
 * other nine — not a second copy of the menu.
 */
const PRIMARY: NavItem[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'nav.leads', icon: Users },
  { to: '/properties', label: 'nav.properties', icon: Building2 },
  { to: '/tasks', label: 'nav.tasks', icon: CalendarCheck },
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

  // Re-read on every navigation, not once per session: the sidebar mounts at
  // login and never unmounts, so a mount-only fetch would show the count from
  // hours ago for the rest of the day. One small GET per screen change.
  const unread = useUnreadCount()
  useEffect(() => {
    const controller = new AbortController()
    refreshUnreadCount(controller.signal)
    return () => {
      controller.abort()
    }
  }, [location.pathname])

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
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] bg-surface">
      {/* vt-* names split the shell into its own view-transition groups, so a
          route change moves only <main> — without them the browser cross-fades
          the sidebar and header too, and identical chrome visibly blinks. */}
      <header className="vt-header z-20 border-b border-rule bg-surface-raised">
        <div className="flex min-w-0 items-center gap-2 px-4 py-2.5 sm:gap-3">
          {/* No × state any more: the drawer is a modal <dialog>, so it paints
              on the top layer and covers this button entirely. It carries its
              own close, and Escape and the backdrop both work. */}
          <button
            type="button"
            aria-label={t('nav.toggle')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="-ml-1 grid size-(--control-h) place-items-center rounded-md text-ink-2 transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken active:translate-y-px lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
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

          {/* Below sm this row is just the menu, the logo and the brand. The
              language switch and sign-out moved into the drawer: at 320px the
              four of them were fighting for one line, and neither is something
              an agent reaches for mid-task. They are unchanged from sm up. */}
          <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
            {user && <span className="text-sm text-muted">{user.name}</span>}
            <LanguageSwitcher />
            <Button
              state={signingOut ? 'loading' : 'idle'}
              onClick={() => void handleSignOut()}
              aria-label={t('auth.signOut')}
            >
              {!signingOut && <LogOut className="size-4" aria-hidden="true" />}
              <span>{signingOut ? t('auth.signingOut') : t('auth.signOut')}</span>
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
        {/* Desktop rail. `hidden lg:block` and nothing else: the mobile menu
            is the drawer below, which overlays instead of pushing — this used
            to toggle block/hidden inside the flex column, so opening it shoved
            the whole screen down. It keeps `vt-sidebar`; the drawer must NOT
            take that name, because a duplicate view-transition-name aborts
            every transition in the document, silently. */}
        <aside className="vt-sidebar hidden min-h-0 shrink-0 overflow-y-auto border-rule bg-surface-raised px-3 py-4 lg:block lg:w-56 lg:border-r">
          <NavLinks scope="sidebar" unread={unread} onNavigate={() => setMenuOpen(false)} />
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
            {/* Catches the lazily-loaded route chunks (see main.tsx). Inside
                the pane, not around the router: up there the header and rail
                would unmount on every navigation. */}
            <Suspense fallback={<LoadingState label={t('common.loading')} />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* The drawer is a <dialog>: showModal() gives the backdrop, Escape, the
          focus trap and `inert` on everything behind it, none of which is code
          we maintain. Closing on a backdrop click is the one it does NOT give
          — Modal adds it for this variant only. Mounted while open, like every
          other Modal here. */}
      {menuOpen && (
        <Modal
          variant="drawer"
          title={t('nav.main')}
          closeLabel={t('common.close')}
          onClose={() => setMenuOpen(false)}
        >
          <NavLinks scope="drawer" unread={unread} onNavigate={() => setMenuOpen(false)} />

          {/* Language and sign-out live here below lg. In the header they were
              competing with the brand for a 320px row; here they are two more
              rows in a list that already scrolls. */}
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-rule pt-4 sm:hidden">
            <LanguageSwitcher />
            <Button
              state={signingOut ? 'loading' : 'idle'}
              onClick={() => void handleSignOut()}
            >
              {!signingOut && <LogOut className="size-4" aria-hidden="true" />}
              {signingOut ? t('auth.signingOut') : t('auth.signOut')}
            </Button>
          </div>
        </Modal>
      )}

      {/* The five things an agent opens all day, one thumb-reach away. A grid
          row of `auto`, not `sticky`: <main> is the scroll container here, so a
          sticky element outside it has nothing to stick to — as a row it is
          fixed by construction, and nothing needs bottom padding to clear it.
          The safe-area inset is what keeps the iPhone's gesture bar off the
          buttons. */}
      <nav
        aria-label={t('nav.primary')}
        className="grid grid-cols-5 border-t border-rule bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            viewTransition
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-(--duration-fast) ease-out ${
                isActive ? 'font-medium text-brand-700' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className="size-5"
                  strokeWidth={isActive ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                <span className="truncate px-1">{t(item.label)}</span>
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-muted transition-colors duration-(--duration-fast) ease-out"
        >
          <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate px-1">{t('nav.more')}</span>
          {unread > 0 && (
            <span className="sr-only">{t('notifications.unread', { count: unread })}</span>
          )}
        </button>
      </nav>
    </div>
  )
}
