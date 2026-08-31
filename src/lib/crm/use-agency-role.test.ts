import { describe, expect, it } from 'vitest'
import type { AuthState, CrmUser } from '@/lib/auth-context'
import { agencyPermissions } from './use-agency-role'

const baseUser: CrmUser = { id: 1, name: 'Ana', email: 'ana@example.com' }
const authenticated = (user: CrmUser): AuthState => ({ status: 'authenticated', user })

describe('agencyPermissions', () => {
  /**
   * El estado real de hoy: la rama del panel que manda `agency_role` no está
   * mergeada, así que contra el backend real el campo no viene. "No sé" tiene
   * que traducirse en "sin mando" — lo contrario ofrecería Reasignar sobre
   * alguien del que no sabemos nada, y el servidor respondería 403.
   */
  it('fails closed when agency_role never arrived', () => {
    expect(agencyPermissions(authenticated(baseUser))).toEqual({
      role: null,
      agencyId: null,
      isAdmin: false,
      known: false,
    })
  })

  it('grants admin to an owner', () => {
    const user: CrmUser = { ...baseUser, agency_role: 'owner', agency_id: 9 }
    expect(agencyPermissions(authenticated(user))).toEqual({
      role: 'owner',
      agencyId: 9,
      isAdmin: true,
      known: true,
    })
  })

  it('grants admin to an admin', () => {
    const user: CrmUser = { ...baseUser, agency_role: 'admin', agency_id: 9 }
    expect(agencyPermissions(authenticated(user))).toEqual({
      role: 'admin',
      agencyId: 9,
      isAdmin: true,
      known: true,
    })
  })

  it('does not grant admin to a plain agent', () => {
    const user: CrmUser = { ...baseUser, agency_role: 'agent', agency_id: 9 }
    expect(agencyPermissions(authenticated(user))).toEqual({
      role: 'agent',
      agencyId: 9,
      isAdmin: false,
      known: true,
    })
  })

  /**
   * `agency_role: null` explícito es el agente que trabaja solo: el servidor
   * SÍ contestó y dijo "ninguna agencia". `isAdmin` da lo mismo que el caso
   * ausente, pero `known` no — una pantalla puede querer decir "no perteneces
   * a ninguna agencia" en este caso y quedarse callada en el otro.
   */
  it('tells apart "no agency" from "no answer"', () => {
    const user: CrmUser = { ...baseUser, agency_role: null, agency_id: null }
    expect(agencyPermissions(authenticated(user))).toEqual({
      role: null,
      agencyId: null,
      isAdmin: false,
      known: true,
    })
  })

  /**
   * Un rol que este frontend todavía no conoce (backend más nuevo, p. ej.
   * `'manager'`). El servidor sí contestó — no es el mismo "no sé" que el
   * campo ausente — pero tampoco le damos mando sobre un rol que no
   * entendemos: falla cerrado igual que el caso ausente.
   *
   * `isAdmin: false` solo no prueba nada: un rol no reconocido tampoco es
   * `'owner'` ni `'admin'`, así que da `false` con o sin el guard de
   * `isAgencyRole()`. Lo que sí muere sin el guard es `role`: sin él, el
   * string crudo del cable ('manager') se colaría en un campo tipado como
   * `AgencyRole | null`. Y `agencyId` tiene que sobrevivir intacto — es lo
   * único que distingue este caso del anterior: aquí sí hay agencia.
   */
  it('fails closed on a role it does not recognize, but keeps the agency it points at', () => {
    const user: CrmUser = {
      ...baseUser,
      agency_role: 'manager' as unknown as CrmUser['agency_role'],
      agency_id: 9,
    }
    expect(agencyPermissions(authenticated(user))).toEqual({
      role: null,
      agencyId: 9,
      isAdmin: false,
      known: true,
    })
  })

  /**
   * Sin sesión autenticada no hay CrmUser del que leer `agency_role`. Esta
   * comprobación vive dentro de la función pura, no en el hook: dejarla en
   * manos del narrowing de TypeScript en quien llama se evapora en cuanto
   * alguien lo silencia con un `as`.
   */
  for (const state of [
    { status: 'loading' },
    { status: 'anonymous' },
    { status: 'error', message: 'Servidor caído' },
  ] satisfies AuthState[]) {
    it(`fails closed when auth state is "${state.status}"`, () => {
      expect(agencyPermissions(state)).toEqual({
        role: null,
        agencyId: null,
        isAdmin: false,
        known: false,
      })
    })
  }
})
