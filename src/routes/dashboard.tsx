import { useAuth } from '@/lib/auth-context'

export function DashboardPage() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null

  return (
    <section>
      <h1 className="text-xl font-semibold text-slate-900">
        Hola, {state.user.name}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Sesión activa por cookie contra el backend Laravel.
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Correo</dt>
          <dd className="mt-1 text-sm text-slate-900">{state.user.email}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">ID de agente</dt>
          <dd className="mt-1 text-sm text-slate-900">{state.user.id}</dd>
        </div>
      </dl>
    </section>
  )
}
