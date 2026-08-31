import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { Button, Card, Field } from '@/components/ui'
import {
  draftFromUser,
  isCompleteProfile,
  updateProfile,
  type ProfileDraft,
} from '@/lib/crm/profile'
import type { CrmUser } from '@/lib/auth-context'

/**
 * La ficha personal, editable. Antes se enseñaba de solo lectura y no había
 * forma de corregir un nombre mal escrito sin salir a la app.
 *
 * Los cuatro campos van SIEMPRE porque el servidor los exige todos. Por eso el
 * formulario arranca precargado en vez de en blanco: mandar el teléfono vacío
 * no es "déjalo como está", es borrarlo.
 */
export function ProfileForm({ user }: { user: CrmUser }) {
  const { t } = useI18n()
  const toast = useToast()
  const { refreshUser } = useAuth()
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromUser(user))
  const [busy, setBusy] = useState(false)

  const set = (field: keyof ProfileDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }))

  // Nada que guardar: el botón no se apaga por "no he tocado nada" sino por
  // "esto no se puede enviar". Un perfil incompleto llega de un alta por
  // Google, que no pide teléfono.
  const complete = isCompleteProfile(draft)

  const save = async () => {
    setBusy(true)
    try {
      await updateProfile(draft)
      // El servidor es la verdad: se relee en vez de dar por bueno el borrador,
      // que es lo que deja una pantalla afirmando un guardado que se normalizó
      // por dentro (el móvil, por ejemplo).
      await refreshUser()
      // Sin toast de éxito: ToastApi solo expone `fail` (mismo motivo que en
      // agency.tsx). Los campos releídos del servidor SON la confirmación.
    } catch (caught: unknown) {
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="grid gap-3 p-4">
      <Field
        id="profile-name"
        label={t('settings.name')}
        value={draft.name}
        onChange={set('name')}
        autoComplete="name"
        required
      />
      <Field
        id="profile-email"
        label={t('auth.email')}
        type="email"
        value={draft.email}
        onChange={set('email')}
        autoComplete="email"
        required
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,8rem)_1fr]">
        <Field
          id="profile-country-code"
          label={t('settings.countryCode')}
          value={draft.country_code}
          onChange={set('country_code')}
          inputMode="numeric"
          placeholder="1"
          required
        />
        <Field
          id="profile-mobile"
          label={t('settings.mobile')}
          type="tel"
          value={draft.mobile}
          onChange={set('mobile')}
          autoComplete="tel"
          required
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {t('settings.agentId')}: {user.id}
        </p>
        <Button
          variant="primary"
          onClick={save}
          disabled={!complete || busy}
          state={busy ? 'loading' : 'idle'}
        >
          {t('common.save')}
        </Button>
      </div>
    </Card>
  )
}
