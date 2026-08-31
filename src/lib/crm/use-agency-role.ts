import type { AuthState } from '@/lib/auth-context'
import { useAuth } from '@/lib/auth-context'
import type { AgencyRole } from './agency'

export type { AgencyRole }

export interface AgencyPermissions {
  role: AgencyRole | null
  agencyId: number | null
  isAdmin: boolean
  /**
   * Si el servidor de verdad contestó la pregunta de rol. `false` es "no lo
   * sé todavía": backend sin `feature/m12-app-prerequisites`, o ningún
   * usuario autenticado del que leer (`loading`, `anonymous`, `error`).
   *
   * "No pertenece a ninguna agencia" se lee con `agencyId === null` bajo
   * `known: true` — NO con `role === null`. Un rol que este frontend no
   * reconoce todavía también cae en `role: null`, pero conserva su
   * `agencyId` porque sí pertenece a una; solo no sabemos qué privilegios
   * trae ese rol.
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
 * Toma el AuthState completo, no un CrmUser ya extraído: fuera de
 * `authenticated` no hay usuario del que leer, y esa comprobación tiene que
 * vivir aquí en vez de depender del narrowing de quien llama —un `as` de
 * por medio lo evapora en silencio— así que falla cerrado igual que el
 * campo ausente.
 *
 * `agency_role` ausente es el estado real de hoy —la rama del panel que lo
 * manda no está mergeada— y frente a eso la respuesta es "no sé" y por tanto
 * "sin mando": lo contrario ofrecería Reasignar sobre alguien del que no
 * sabemos nada, y el servidor respondería 403.
 *
 * `agency_role: null` explícito sí es una respuesta del servidor (el agente
 * que trabaja solo), y un rol que este frontend no reconoce todavía —un
 * backend más nuevo— tampoco es el "no sé" del campo ausente: el servidor
 * contestó, solo que con algo que esta función no sabe interpretar como
 * privilegio. Por eso conserva `agencyId` pero no `role`.
 */
export function agencyPermissions(state: AuthState): AgencyPermissions {
  if (state.status !== 'authenticated') return UNKNOWN

  const user = state.user
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

/** Envoltura sobre useAuth(): lee el AuthState, no le queda nada que decidir. */
export function useAgencyRole(): AgencyPermissions {
  return agencyPermissions(useAuth().state)
}
