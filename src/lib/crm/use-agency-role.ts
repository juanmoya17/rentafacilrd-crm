import type { CrmUser } from '@/lib/auth-context'
import { useAuth } from '@/lib/auth-context'
import type { AgencyRole } from './agency'

export type { AgencyRole }

export interface AgencyPermissions {
  role: AgencyRole | null
  agencyId: number | null
  isAdmin: boolean
  /**
   * Si el servidor de verdad contestó la pregunta. `false` es "no lo sé
   * todavía" (backend sin `feature/m12-app-prerequisites`, o sin sesión) —
   * distinto de `role: null` con `known: true`, que es "sí pertenece a la
   * respuesta, y la respuesta es ninguna agencia".
   */
  known: boolean
}

const UNKNOWN: AgencyPermissions = { role: null, agencyId: null, isAdmin: false, known: false }

function isAgencyRole(role: string): role is AgencyRole {
  return role === 'owner' || role === 'admin' || role === 'agent'
}

/**
 * La decisión pura: puede este usuario administrar su agencia.
 *
 * `agency_role` ausente es el estado real de hoy —la rama del panel que lo
 * manda no está mergeada— y frente a eso la respuesta es "no sé" y por tanto
 * "sin mando": lo contrario ofrecería Reasignar sobre alguien del que no
 * sabemos nada, y el servidor respondería 403.
 *
 * `agency_role: null` explícito sí es una respuesta del servidor (el agente
 * que trabaja solo), y un rol que este frontend no reconoce todavía —un
 * backend más nuevo— tampoco es el "no sé" del campo ausente. Ninguno de los
 * dos da mando: uno porque no hay agencia, el otro porque no sabemos qué
 * privilegios trae un rol que no existía cuando se escribió esta función.
 */
export function agencyPermissions(user: CrmUser): AgencyPermissions {
  if (user.agency_role === undefined) return UNKNOWN

  const role = user.agency_role
  if (role !== null && !isAgencyRole(role)) {
    return { role: null, agencyId: user.agency_id ?? null, isAdmin: false, known: true }
  }

  return {
    role,
    agencyId: user.agency_id ?? null,
    isAdmin: role === 'owner' || role === 'admin',
    known: true,
  }
}

/** Envoltura sobre useAuth(): sin sesión autenticada no hay usuario del que leer. */
export function useAgencyRole(): AgencyPermissions {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return UNKNOWN
  return agencyPermissions(state.user)
}
