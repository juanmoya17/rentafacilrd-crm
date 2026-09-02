import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, api, setUnauthorizedHandler } from '@/lib/api'
import { exchangeGoogleCredential, signInWithGoogle } from '@/lib/crm/google-login'
import { finishGoogleRedirect } from '@/lib/firebase'
import { AuthContext, type AuthState, type CrmUser } from '@/lib/auth-context'
import { resourceCache } from '@/lib/resource-cache'

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

  // Same shape as login(): the popup and the POST both throw, and the caller
  // turns that into copy. Nothing is set unless a user actually came back.
  const loginWithGoogle = useCallback(async () => {
    const user = await signInWithGoogle()
    setState({ status: 'authenticated', user })
  }, [])

  /**
   * La otra mitad del flujo por redirect, que en móvil sustituye al popup.
   *
   * Misma forma que loginWithGoogle() —lanza, y quien llama lo convierte en
   * copy— con un caso más: `false` cuando esta carga no viene de Google, que
   * es lo que devuelve en cualquier visita normal a /login.
   */
  const completeGoogleRedirect = useCallback(async () => {
    const credential = await finishGoogleRedirect()
    if (credential === null) return false

    setState({ status: 'authenticated', user: await exchangeGoogleCredential(credential) })

    return true
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('web-logout', { method: 'POST' })
    } finally {
      // Drop the local session even if the call failed, otherwise a network
      // blip leaves the UI logged in against a dead session. The error still
      // propagates so the caller can surface it.
      //
      // The cache goes with it: it holds leads, and leads are names and phone
      // numbers. On a phone that gets handed between agents, the next person
      // signing in must not paint the previous one's pipeline for a frame.
      resourceCache.clear()
      setState({ status: 'anonymous' })
    }
  }, [])

  /**
   * Tras guardar el perfil. No reutiliza `retry()` a propósito: aquel pasa por
   * `loading`, que desmonta la pantalla de ajustes y devuelve al usuario a un
   * spinner justo después de pulsar Guardar.
   *
   * Un fallo aquí se traga: el guardado YA ocurrió y el servidor es la verdad.
   * Lo único que queda desactualizado es la copia en memoria, hasta la próxima
   * carga.
   */
  const refreshUser = useCallback(async () => {
    try {
      const response = await api<Envelope<CrmUser>>('get-user-data')
      if (response.data) setState({ status: 'authenticated', user: response.data })
    } catch {
      // Deliberado: ver el comentario de arriba.
    }
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setProbe((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({ state, login, loginWithGoogle, completeGoogleRedirect, logout, retry, refreshUser }),
    [state, login, loginWithGoogle, completeGoogleRedirect, logout, retry, refreshUser],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
