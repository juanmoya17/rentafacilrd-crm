import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, api, setUnauthorizedHandler } from '@/lib/api'
import { AuthContext, type AuthState, type CrmUser } from '@/lib/auth-context'

interface Envelope<T> {
  error: boolean
  message?: string
  data?: T
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [probe, setProbe] = useState(0)

  // A 401 on ANY call — not just the session probe — drops the session.
  // RequireAuth turns that state change into the redirect.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setState({ status: 'anonymous' })
    })
    return () => {
      setUnauthorizedHandler(null)
    }
  }, [])

  // Ask the backend who we are on boot and after every retry. Until it answers
  // we stay in `loading`, so a hard refresh never flashes the login screen.
  useEffect(() => {
    const controller = new AbortController()

    api<Envelope<CrmUser>>('get-user-data', { silent401: true, signal: controller.signal })
      .then((response) => {
        setState(
          response.data
            ? { status: 'authenticated', user: response.data }
            : { status: 'anonymous' },
        )
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // 401 is the normal "no session" answer. Anything else is a real fault
        // and must not be dressed up as a logged-out user.
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: 'anonymous' })
          return
        }
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'No pudimos contactar el servidor.',
        })
      })

    return () => {
      controller.abort()
    }
  }, [probe])

  const login = useCallback(async (email: string, password: string) => {
    // api() already throws on {error:true}, which is how a deactivated account
    // (HTTP 200) and a bad password (422) both surface.
    const response = await api<Envelope<CrmUser>>('web-login', {
      method: 'POST',
      body: { email, password },
    })
    if (!response.data) {
      throw new ApiError('El servidor no devolvió el usuario.', 200, response)
    }
    setState({ status: 'authenticated', user: response.data })
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('web-logout', { method: 'POST' })
    } finally {
      // Drop the local session even if the call failed, otherwise a network
      // blip leaves the UI logged in against a dead session. The error still
      // propagates so the caller can surface it.
      setState({ status: 'anonymous' })
    }
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setProbe((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({ state, login, logout, retry }),
    [state, login, logout, retry],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
