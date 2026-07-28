import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/lib/auth-context'

/**
 * The SPA's only auth gate. Every route except /login hangs below this in the
 * router, so protection is the default — a new route is secured unless somebody
 * deliberately moves it out.
 */
export function RequireAuth() {
  const { state, retry } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50" role="status">
        <p className="text-sm text-slate-500">Verificando sesión…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <div className="max-w-sm text-center" role="alert">
          <h1 className="text-lg font-semibold text-slate-900">
            No pudimos contactar el servidor
          </h1>
          <p className="mt-2 text-sm text-slate-600">{state.message}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'anonymous') {
    // `replace` so Back never lands on a CRM screen after signing out.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}
