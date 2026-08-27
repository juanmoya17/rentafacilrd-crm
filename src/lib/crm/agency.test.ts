import { describe, expect, it } from 'vitest'
import {
  assignedAgentName,
  canFilterByMember,
  canInvite,
  claimKey,
  claimKeyToItem,
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

describe('assignedAgentName', () => {
  it('says nothing on my own listing — that would be noise on every row I see', () => {
    expect(assignedAgentName(1, 'Ana', 1)).toBeNull()
  })

  it('names a colleague', () => {
    expect(assignedAgentName(1, 'Ana', 2)).toBe('Ana')
  })

  it('says nothing when the colleague\'s account was deleted', () => {
    // "Asignada a —" no informa de nada.
    expect(assignedAgentName(1, null, 2)).toBeNull()
  })

  it('says nothing on my own listing even if my name were null, guard order must not matter', () => {
    expect(assignedAgentName(1, null, 1)).toBeNull()
  })

  it('says nothing while the session is still resolving who is looking', () => {
    // Falla cerrado: mejor no pintar una etiqueta un instante que pintar
    // "Asignada a Ana" sobre el propio anuncio de Ana mientras el contexto
    // de autenticación todavía no sabe quién mira.
    expect(assignedAgentName(1, 'Ana', undefined)).toBeNull()
  })

  it('says nothing when the backend has not shipped the fields yet and they arrive as undefined', () => {
    // La rama que manda added_by/added_by_name no está mergeada: declararlos
    // requeridos en TypeScript no impide que hoy lleguen `undefined` en
    // ejecución. Sin esto, `t('…assignedTo', { name: undefined })` pinta
    // literalmente "Asignada a undefined".
    const addedByName = undefined as unknown as string | null
    expect(assignedAgentName(2, addedByName, 1)).toBeNull()
  })
})

describe('canFilterByMember', () => {
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

  it('offers nothing while the roster is empty — still loading, or the fetch failed', () => {
    expect(canFilterByMember([])).toBe(false)
  })

  it('offers nothing for a single active member — filtering a one-person team cannot change the result', () => {
    expect(canFilterByMember([member(1, 'active')])).toBe(false)
  })

  it('offers the filter for two active members', () => {
    expect(canFilterByMember([member(1, 'active'), member(2, 'active')])).toBe(true)
  })

  it('offers the filter when one of the two is suspended — a suspended member still owns listings', () => {
    expect(canFilterByMember([member(1, 'active'), member(2, 'suspended')])).toBe(true)
  })

  it('does not count a member who has exited — their portfolio was merged away in the exit wizard', () => {
    expect(canFilterByMember([member(1, 'active'), member(2, 'ended')])).toBe(false)
  })
})

describe('claimKey', () => {
  it('keeps a property and a project with the same id apart', () => {
    // Las dos tablas numeran por separado. Sin el tipo delante, marcar la
    // propiedad 7 marcaría también el proyecto 7 — y se incorporaría el
    // anuncio equivocado sin que nada falle a la vista.
    expect(claimKey({ listing_type: 'property', id: 7 })).not.toBe(
      claimKey({ listing_type: 'project', id: 7 }),
    )
  })

  it('round-trips back into what the endpoint expects', () => {
    expect(claimKeyToItem(claimKey({ listing_type: 'project', id: 12 }))).toEqual({
      type: 'project',
      id: 12,
    })
  })
})
