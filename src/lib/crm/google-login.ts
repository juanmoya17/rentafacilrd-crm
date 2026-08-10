import { ApiError, api } from '@/lib/api'
import type { CrmUser } from '@/lib/auth-context'
import { getGoogleIdToken, type GoogleCredential } from '@/lib/firebase'

interface Envelope<T> {
  error: boolean
  message?: string
  data?: T
}

export interface GoogleSignupBody {
  type: '0'
  id_token: string
  name: string
}

/**
 * `type: '0'` is Google in ApiController's vocabulary. No `email`: the server
 * reads identity off the verified claims and ignores a body email, and not
 * sending one keeps this client honest about that.
 */
export function googleSignupBody(credential: GoogleCredential): GoogleSignupBody {
  return { type: '0', id_token: credential.idToken, name: credential.name }
}

export type GoogleErrorKey =
  | 'popupClosed'
  | 'popupBlocked'
  | 'unauthorizedDomain'
  | 'rejected'
  | 'conflict'
  | 'emailUnverified'
  | 'generic'

function firebaseCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

/** The server's `key` field — the same mechanism accountDeactivated uses. */
function serverKey(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  const payload = error.payload
  if (typeof payload !== 'object' || payload === null) return null
  const key = (payload as { key?: unknown }).key
  return typeof key === 'string' ? key : null
}

export function googleErrorKey(error: unknown): GoogleErrorKey {
  switch (firebaseCode(error)) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'popupClosed'
    case 'auth/popup-blocked':
      return 'popupBlocked'
    case 'auth/unauthorized-domain':
      return 'unauthorizedDomain'
  }

  // Both refusals are 409, so the status alone cannot tell them apart and
  // half the people who hit one would be told to do the wrong thing.
  switch (serverKey(error)) {
    case 'googleEmailUnverified':
      return 'emailUnverified'
    case 'googleEmailAmbiguous':
      return 'conflict'
  }

  if (error instanceof ApiError) {
    if (error.status === 401) return 'rejected'
    if (error.status === 409) return 'conflict'
  }

  return 'generic'
}

/** Popup → token → session. Throws; the caller maps with googleErrorKey. */
export async function signInWithGoogle(): Promise<CrmUser> {
  const credential = await getGoogleIdToken()
  const response = await api<Envelope<CrmUser>>('user_signup', {
    method: 'POST',
    body: googleSignupBody(credential),
  })
  if (!response.data) {
    throw new ApiError('El servidor no devolvió el usuario.', 200, response)
  }
  return response.data
}
