import { describe, expect, it } from 'vitest'
import type { CrmUser } from '@/lib/auth-context'
import { agencyPermissions } from './use-agency-role'

const baseUser: CrmUser = { id: 1, name: 'Ana', email: 'ana@example.com' }

describe('agencyPermissions', () => {
  /**
   * El estado real de hoy: la rama del panel que manda `agency_role` no está
   * mergeada, así que contra el backend real el campo no viene. "No sé" tiene
   * que traducirse en "sin mando" — lo contrario ofrecería Reasignar sobre
   * alguien del que no sabemos nada, y el servidor respondería 403.
   */
  it('fails closed when agency_role never arrived', () => {
    expect(agencyPermissions(baseUser)).toEqual({
      role: null,
      agencyId: null,
      isAdmin: false,
      known: false,
    })
  })

  it('grants admin to an owner', () => {
    const user: CrmUser = { ...baseUser, agency_role: 'owner', agency_id: 9 }
    expect(agencyPermissions(user)).toEqual({
      role: 'owner',
      agencyId: 9,
      isAdmin: true,
      known: true,
    })
  })

  it('grants admin to an admin', () => {
    const user: CrmUser = { ...baseUser, agency_role: 'admin', agency_id: 9 }
    expect(agencyPermissions(user)).toEqual({
      role: 'admin',
      agencyId: 9,
      isAdmin: true,
      known: true,
    })
  })

  it('does not grant admin to a plain agent', () => {
    const user: CrmUser = { ...baseUser, agency_role: 'agent', agency_id: 9 }
    expect(agencyPermissions(user)).toEqual({
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
    expect(agencyPermissions(user)).toEqual({
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
   */
  it('fails closed on a role it does not recognize', () => {
    const user: CrmUser = {
      ...baseUser,
      agency_role: 'manager' as unknown as CrmUser['agency_role'],
      agency_id: 9,
    }
    expect(agencyPermissions(user).isAdmin).toBe(false)
  })
})
