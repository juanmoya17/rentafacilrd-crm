/**
 * `/api/update_profile` — el perfil personal de quien usa el CRM.
 *
 * No confundir con `crm/agency.ts`: aquello es la EMPRESA, esto es la PERSONA.
 * El spec pide las dos fichas por separado y el backend las tiene separadas
 * (`update_profile` y `update-company-profile`), por el mismo motivo que
 * explica la ruta: mezclarlas obliga a reenviar campos de la otra y un
 * formulario viejo pisa datos que nadie quiso tocar.
 */

import { api } from '@/lib/api'
import type { CrmUser } from '@/lib/auth-context'
import type { Envelope } from './api'

export interface ProfileDraft {
  name: string
  email: string
  mobile: string
  country_code: string
}

/**
 * Los cuatro campos son obligatorios en el servidor, así que van siempre los
 * cuatro. Es la razón de que el formulario los precargue en vez de empezar en
 * blanco: un envío parcial no es "no cambiar eso", es un 400 —o peor, un
 * guardado con el campo vacío.
 */
export function isCompleteProfile(draft: ProfileDraft): boolean {
  return (
    draft.name.trim() !== '' &&
    draft.email.trim() !== '' &&
    draft.mobile.trim() !== '' &&
    draft.country_code.trim() !== ''
  )
}

/** Lo que el formulario debe precargar. Un campo ausente arranca vacío, no `undefined`. */
export function draftFromUser(user: CrmUser): ProfileDraft {
  return {
    name: user.name ?? '',
    email: user.email ?? '',
    mobile: user.mobile ?? '',
    country_code: user.country_code ?? '',
  }
}

export async function updateProfile(draft: ProfileDraft): Promise<void> {
  await api<Envelope<unknown>>('update_profile', { method: 'POST', body: draft })
}
