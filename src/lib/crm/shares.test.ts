import { describe, expect, it } from 'vitest'
import { CONTRACT_TYPES, SHARE_STATUSES, contractUrl } from './shares'

/**
 * Las listas son la fuente de la que sale el tipo, no una copia suya: con las
 * dos escritas a mano, añadir un tipo al union y olvidarlo en la lista compila
 * sin quejarse y deja una opción que el usuario no puede elegir.
 */
describe('shares constants', () => {
  it('offers every contract type the backend enum accepts', () => {
    expect([...CONTRACT_TYPES]).toEqual(['co_brokerage', 'referral', 'shared_exclusive'])
  })

  it('knows every status the backend can return', () => {
    expect([...SHARE_STATUSES]).toEqual(['pending', 'active', 'rejected', 'revoked'])
  })
})

describe('contractUrl', () => {
  // Se abre en pestaña, así que tiene que llevar el mismo prefijo que api()
  // en vez de una copia que se quede atrás cuando cambie.
  it('builds an absolute path through the shared api prefix', () => {
    expect(contractUrl(7)).toBe('/api/crm/property-shares/7/contract')
  })
})
