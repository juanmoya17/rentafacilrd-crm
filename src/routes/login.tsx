import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button, Field } from '@/components/ui'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const { state, login } = useAuth()
  const location = useLocation()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Don't decide anything until the boot probe answers, or a refresh on /login
  // would flash the form at an already-authenticated agent.
  if (state.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface" role="status">
        <p className="text-sm text-muted">{t('auth.checking')}</p>
      </div>
    )
  }

  if (state.status === 'authenticated') {
    const from = (location.state as LocationState | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
    } catch (caught: unknown) {
      // The backend already localises its message via Content-Language; the
      // fallback is for network-level failures that never reached it.
      setError(caught instanceof Error ? caught.message : t('auth.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-sm rounded-lg border border-rule bg-surface-raised p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-lg font-semibold tracking-tight text-ink">
              {t('app.name')}
            </h1>
            <p className="mt-1 text-sm text-muted">{t('auth.subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </div>

        {/* One form-level alert: the backend does not say which of the two
            fields was wrong, so neither field claims its own message. They
            only borrow the invalid border. */}
        {error && (
          <p role="alert" className="mt-4 rounded-md bg-error-bg px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <Field
            id="email"
            type="email"
            label={t('auth.email')}
            autoComplete="email"
            required
            value={email}
            onChange={setEmail}
            invalid={error !== null}
          />
          <Field
            id="password"
            type="password"
            label={t('auth.password')}
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
            invalid={error !== null}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          state={submitting ? 'loading' : 'idle'}
          className="mt-6 w-full"
        >
          {submitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
    </div>
  )
}
