import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { googleErrorKey, googleSignupBody } from './google-login'

describe('googleSignupBody', () => {
  it('sends the token and the name, and never an email', () => {
    const body = googleSignupBody({ idToken: 'tok', name: 'Ana' })
    expect(body).toEqual({ type: '0', id_token: 'tok', name: 'Ana' })
    // The server reads identity off the claims and ignores a body email.
    // Not sending one keeps the client honest about that.
    expect('email' in body).toBe(false)
  })
})

describe('googleErrorKey', () => {
  it('separates a closed popup from a blocked one', () => {
    expect(googleErrorKey({ code: 'auth/popup-closed-by-user' })).toBe('popupClosed')
    expect(googleErrorKey({ code: 'auth/cancelled-popup-request' })).toBe('popupClosed')
    expect(googleErrorKey({ code: 'auth/popup-blocked' })).toBe('popupBlocked')
  })

  it('names the misconfiguration that looks like a random failure', () => {
    // Without crm.rentafacilrd.com in Firebase's authorized domains this is
    // the only symptom, and "algo salió mal" would send someone debugging
    // the wrong layer for an afternoon.
    expect(googleErrorKey({ code: 'auth/unauthorized-domain' })).toBe('unauthorizedDomain')
  })

  it('maps the server answers', () => {
    expect(googleErrorKey(new ApiError('x', 401))).toBe('rejected')
    expect(googleErrorKey(new ApiError('x', 409))).toBe('conflict')
    expect(googleErrorKey(new ApiError('x', 500))).toBe('generic')
  })

  it('tells the two 409s apart by their key, not their status', () => {
    // Same status, opposite advice: one says use your password, the other
    // says go verify your address with Google.
    const ambiguous = new ApiError('x', 409, { key: 'googleEmailAmbiguous' })
    const unverified = new ApiError('x', 409, { key: 'googleEmailUnverified' })
    expect(googleErrorKey(ambiguous)).toBe('conflict')
    expect(googleErrorKey(unverified)).toBe('emailUnverified')
  })

  it('falls back to generic for anything unrecognised', () => {
    expect(googleErrorKey(new Error('boom'))).toBe('generic')
    expect(googleErrorKey(null)).toBe('generic')
  })
})
