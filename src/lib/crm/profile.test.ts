import { describe, expect, it } from 'vitest'
import { draftFromUser, isCompleteProfile } from './profile'
import type { CrmUser } from '@/lib/auth-context'

const user = (over: Partial<CrmUser> = {}): CrmUser => ({
  id: 42,
  name: 'Agente Demo',
  email: 'agente@test.com',
  mobile: '8095550142',
  country_code: '1',
  ...over,
})

describe('draftFromUser', () => {
  it('carries the four fields the endpoint requires', () => {
    expect(draftFromUser(user())).toEqual({
      name: 'Agente Demo',
      email: 'agente@test.com',
      mobile: '8095550142',
      country_code: '1',
    })
  })

  // Un alta por Google no pide teléfono. Si el borrador arrancara en
  // `undefined`, React trataría el campo como no controlado y el primer
  // tecleo tiraría un aviso; peor, un `undefined` enviado se serializa fuera
  // del JSON y el servidor lo lee como campo ausente.
  it('turns a missing phone into an empty string, never undefined', () => {
    const draft = draftFromUser(user({ mobile: null, country_code: undefined }))

    expect(draft.mobile).toBe('')
    expect(draft.country_code).toBe('')
  })
})

describe('isCompleteProfile', () => {
  it('accepts a draft with all four filled', () => {
    expect(isCompleteProfile(draftFromUser(user()))).toBe(true)
  })

  // El servidor exige los cuatro. Dejar enviar con uno vacío no es "no
  // cambiar ese", es borrarlo.
  it.each(['name', 'email', 'mobile', 'country_code'] as const)('rejects a blank %s', (field) => {
    expect(isCompleteProfile({ ...draftFromUser(user()), [field]: '   ' })).toBe(false)
  })
})
