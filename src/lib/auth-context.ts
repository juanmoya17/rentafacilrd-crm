import { createContext, useContext } from 'react'

/** Only the fields the CRM actually reads off Customer. Widen as screens need more. */
export interface CrmUser {
  id: number
  name: string
  email: string
  profile?: string | null
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: CrmUser }
  | { status: 'anonymous' }
  /** Backend unreachable or 5xx — distinct from "not logged in", or we would
   *  show a login form when the API is simply down. */
  | { status: 'error'; message: string }

export interface AuthContextValue {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return value
}
