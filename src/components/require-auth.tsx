import { Navigate, Outlet, useLocation } from 'react-router'
import { isVerifiedAgent, useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n/context'
import { Button } from '@/components/ui'
import { VerificationPending } from '@/components/verification-pending'

/**
 * The SPA's only auth gate. Every route except /login hangs below this in the
 * router, so protection is the default — a new route is secured unless somebody
 * deliberately moves it out.
 *
 * It gates on two things: a session, and verified-agent status. Signing in is
 * not enough — anyone can publish a listing, but the CRM is for verified agents.
 */
export function RequireAuth() {
  const { state, retry } = useAuth()
  const location = useLocation()
  const t = useT()

  if (state.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface" role="status">
        <p className="text-sm text-muted">{t('auth.checking')}</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface px-4">
        <div className="max-w-sm text-center" role="alert">
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            {t('error.backendTitle')}
          </h1>
          <p className="mt-2 text-sm text-ink-2">{state.message}</p>
          <div className="mt-4">
            <Button variant="primary" onClick={retry}>
              {t('error.retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (state.status === 'anonymous') {
    // `replace` so Back never lands on a CRM screen after signing out.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  // Signed in, but not a verified agent: explain instead of bouncing them back
  // to a login screen they just passed.
  if (!isVerifiedAgent(state.user)) {
    return <VerificationPending />
  }

  return <Outlet />
}
