import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, setUnauthorizedHandler } from '@/lib/api'
import { CONTRACT_TYPES, SHARE_STATUSES, fetchContract } from './shares'

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

describe('fetchContract', () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    globalThis.fetch = fetchMock
    fetchMock.mockReset()
  })
  afterEach(() => setUnauthorizedHandler(null))

  it('sends the session cookie and asks for a PDF, returning the blob', async () => {
    fetchMock.mockResolvedValue(new Response('%PDF-1.4', { status: 200 }))
    const blob = await fetchContract(7)
    const call = fetchMock.mock.calls[0]
    const init = call?.[1]
    expect(call?.[0]).toBe('/api/crm/property-shares/7/contract')
    expect(init?.credentials).toBe('include')
    expect(init?.headers).toMatchObject({ Accept: 'application/pdf' })
    expect(await blob.text()).toBe('%PDF-1.4')
  })

  it('maps 401 to the unauthorized flow', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(new Response('{"message":"x"}', { status: 401 }))
    await expect(fetchContract(7)).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledOnce()
  })

  it.each([403, 404])('surfaces %i as an ApiError carrying the status', async (status) => {
    fetchMock.mockResolvedValue(new Response('{"message":"no"}', { status }))
    const error = await fetchContract(7).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status })
  })
})
