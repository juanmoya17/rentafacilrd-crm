import { describe, expect, it } from 'vitest'
import {
  canInvite,
  exitReceivers,
  holdsSomething,
  seatsLabel,
  type AgencyMember,
  type ExitPreflight,
} from './agency'

describe('seatsLabel', () => {
  it('shows infinity for an unlimited plan, never zero', () => {
    // `null` es "sin límite" y 0 sería "plan agotado" — leerían al revés.
    expect(seatsLabel(3, null)).toBe('3 / ∞')
    expect(seatsLabel(3, 0)).toBe('3 / 0')
  })

  it('shows used over limit', () => {
    expect(seatsLabel(2, 5)).toBe('2 / 5')
  })
})

describe('canInvite', () => {
  it('allows an invitation while there is room', () => {
    expect(canInvite({ seats_used: 2, seats_limit: 5, over_capacity: false })).toBe(true)
  })

  it('refuses at exactly the cap', () => {
    expect(canInvite({ seats_used: 5, seats_limit: 5, over_capacity: false })).toBe(false)
  })

  it('always allows on an unlimited plan', () => {
    expect(canInvite({ seats_used: 99, seats_limit: null, over_capacity: false })).toBe(true)
  })

  /**
   * El caso que el conteo por sí solo no distingue: el plan bajó con el equipo
   * ya montado. No se suspende a nadie, así que la lista sigue mostrando a
   * todos y lo único que cambia es que no se puede crecer.
   */
  it('refuses when the plan shrank under an existing team', () => {
    expect(canInvite({ seats_used: 5, seats_limit: 2, over_capacity: true })).toBe(false)
  })
})

describe('holdsSomething', () => {
  const empty: ExitPreflight = {
    properties: 0,
    projects: 0,
    open_leads: 0,
    contacts: 0,
    open_tasks: 0,
  }

  it('says nothing moves when every count is zero', () => {
    expect(holdsSomething(empty)).toBe(false)
  })

  it('catches a single non-zero count, whichever it is', () => {
    // Cada campo por separado: un `||` al que le falte uno pasaría igual con
    // un fixture que solo llenara `properties`.
    for (const key of Object.keys(empty) as (keyof ExitPreflight)[]) {
      expect(holdsSomething({ ...empty, [key]: 1 })).toBe(true)
    }
  })
})

describe('exitReceivers', () => {
  const member = (id: number, status: AgencyMember['status']): AgencyMember => ({
    id,
    customer_id: id * 10,
    name: `M${id}`,
    email: null,
    mobile: null,
    profile: null,
    role: 'agent',
    status,
    joined_at: null,
  })

  it('never offers the person who is leaving', () => {
    const list = exitReceivers([member(1, 'active'), member(2, 'active')], 1)
    expect(list.map((m) => m.id)).toEqual([2])
  })

  it('never offers a suspended colleague', () => {
    // El servidor los rechaza con `bad_receiver`; la pantalla no debería
    // llegar a ofrecerlos.
    const list = exitReceivers([member(1, 'active'), member(2, 'suspended')], 3)
    expect(list.map((m) => m.id)).toEqual([1])
  })
})
