import { createContext, useContext } from 'react'

/**
 * Only the fields the CRM actually reads off Customer. Wire shape, so the keys
 * stay snake_case exactly as the API sends them. Widen as screens need more.
 */
export interface CrmUser {
  id: number
  name: string
  email: string
  profile?: string | null
  /**
   * `update_profile` EXIGE los cuatro: name, email, mobile y country_code.
   * `get-user-data` devuelve el Customer entero, así que ya llegaban por el
   * cable — solo faltaba declararlos. Sin ellos el formulario mandaría vacío
   * y borraría el teléfono de quien solo quería cambiarse el nombre.
   */
  mobile?: string | null
  country_code?: string | null
  /** Derived server-side from a successful verify_customers row. */
  is_verified_agent?: boolean
  verification_status?: 'unverified_user' | 'verified_user' | 'verified_agent'
  /** 'owner' | 'admin' | 'agent'. Ausente = backend sin `feature/m12-app-prerequisites`. */
  agency_role?: 'owner' | 'admin' | 'agent' | null
  /** La agencia de quien pregunta. Ausente por el mismo motivo. */
  agency_id?: number | null
}

/**
 * The CRM is for verified agents. Fails closed: a missing flag — an old backend,
 * a trimmed payload — counts as not verified rather than letting someone in.
 *
 * This is a UI gate only. The real one is the `verified.agent` middleware on the
 * API; never treat this as the security boundary.
 */
export function isVerifiedAgent(user: CrmUser): boolean {
  return user.is_verified_agent === true
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
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  retry: () => void
  /** Relee al usuario SIN pasar por `loading`: `retry()` desmonta la pantalla. */
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return value
}
