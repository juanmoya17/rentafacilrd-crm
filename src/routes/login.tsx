import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n/context'
import { useResource } from '@/lib/use-resource'
import { isSocialLoginEnabled } from '@/lib/crm/settings'
import { googleErrorKey, type GoogleErrorKey } from '@/lib/crm/google-login'
import { isFirebaseConfigured } from '@/lib/firebase'
import type { TranslationKey } from '@/lib/i18n/es'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button, Field } from '@/components/ui'

interface LocationState {
  from?: string
}

/**
 * Explicit rather than a `auth.google.${key}` template cast: a future
 * `GoogleErrorKey` with no translation would otherwise render the raw key
 * string to the user instead of failing to compile.
 */
const GOOGLE_ERROR_COPY: Record<GoogleErrorKey, TranslationKey> = {
  popupClosed: 'auth.google.popupClosed',
  popupBlocked: 'auth.google.popupBlocked',
  unauthorizedDomain: 'auth.google.unauthorizedDomain',
  rejected: 'auth.google.rejected',
  conflict: 'auth.google.conflict',
  emailUnverified: 'auth.google.emailUnverified',
  noPassword: 'auth.google.noPassword',
  generic: 'auth.google.generic',
}

export function LoginPage() {
  const { state, login, loginWithGoogle } = useAuth()
  const location = useLocation()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Separate from `error`: a Google failure must not mark the email/password
  // fields invalid, since neither was ever touched. Separate `submitting`
  // too, so the popup being open doesn't show "Iniciando sesión…" on a
  // password submit that never happened, and the Google button gets its own
  // progress feedback.
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const socialLogin = useResource((signal) => isSocialLoginEnabled(signal), [])

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

  const handleGoogle = async () => {
    setGoogleSubmitting(true)
    setGoogleError(null)
    try {
      await loginWithGoogle()
    } catch (caught: unknown) {
      const key = googleErrorKey(caught)
      // `generic` covers every server refusal the key mapper doesn't have a
      // dedicated case for (throttling, a deactivated account, ...) — the
      // server already localised that message, so show it instead of the
      // generic copy when there is one to show.
      const message =
        key === 'generic' && caught instanceof Error && caught.message !== ''
          ? caught.message
          : t(GOOGLE_ERROR_COPY[key])
      setGoogleError(message)
    } finally {
      setGoogleSubmitting(false)
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
          disabled={googleSubmitting}
          className="mt-6 w-full"
        >
          {submitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>

        {socialLogin.status === 'ready' && socialLogin.data && isFirebaseConfigured() && (
          <div className="mt-4 border-t border-rule pt-4">
            {/* Its own alert, separate from the form-level one above: a
                Google failure is not about the email/password fields, so it
                gets its own message rather than borrowing (and dirtying)
                theirs. */}
            {googleError && (
              <p
                role="alert"
                className="mb-3 rounded-md bg-error-bg px-3 py-2 text-sm text-error"
              >
                {googleError}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              state={googleSubmitting ? 'loading' : 'idle'}
              disabled={submitting}
              className="w-full"
              onClick={() => void handleGoogle()}
            >
              {t('auth.google')}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
