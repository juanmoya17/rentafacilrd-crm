import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, setUnauthorizedHandler } from './api'

function setCookie(value: string): void {
  Object.defineProperty(globalThis, 'document', {
    value: { cookie: value },
    writable: true,
    configurable: true,
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function headersOf(call: Parameters<typeof fetch> | undefined): Record<string, string> {
  return (call?.[1]?.headers ?? {}) as Record<string, string>
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  globalThis.fetch = fetchMock
  fetchMock.mockReset()
  setCookie('XSRF-TOKEN=tok-1')
})

afterEach(() => {
  setUnauthorizedHandler(null)
})

describe('api()', () => {
  it('sends the XSRF header and credentials on mutations, without re-priming an existing cookie', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: false, data: { id: 7 } }))

    await api('web-login', { method: 'POST', body: { email: 'a@b.c', password: 'x' } })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(headersOf(fetchMock.mock.calls[0])['X-XSRF-TOKEN']).toBe('tok-1')
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('include')
  })

  it('never sends the XSRF header on reads', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: false, data: null }))

    await api('get-user-data')

    expect(headersOf(fetchMock.mock.calls[0])['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('re-primes the CSRF cookie and retries exactly once on 419', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 419 }))
      .mockImplementationOnce(() => {
        setCookie('XSRF-TOKEN=tok-2')
        return Promise.resolve(new Response(null, { status: 204 }))
      })
      .mockResolvedValueOnce(jsonResponse({ error: false, data: { ok: true } }))

    await api('web-logout', { method: 'POST' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/sanctum/csrf-cookie')
    // The retry must carry the refreshed token, not the stale one.
    expect(headersOf(fetchMock.mock.calls[2])['X-XSRF-TOKEN']).toBe('tok-2')
  })

  it('stops after one retry when 419 repeats', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 419 }))

    await expect(api('web-logout', { method: 'POST' })).rejects.toThrow(ApiError)
    // request, csrf prime, retry — and no further loop.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('treats HTTP 200 with {error:true} as a failure (deactivated account)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: true, message: 'Your account has been deactivated' }),
    )

    await expect(
      api('web-login', { method: 'POST', body: { email: 'a@b.c', password: 'x' } }),
    ).rejects.toThrow('Your account has been deactivated')
  })

  it('fires the unauthorized handler on 401', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockResolvedValue(jsonResponse({ error: true }, 401))

    await expect(api('get-user-data')).rejects.toThrow(ApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not fire the unauthorized handler when silent401 is set', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockResolvedValue(jsonResponse({ error: true }, 401))

    await expect(api('get-user-data', { silent401: true })).rejects.toThrow(ApiError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
