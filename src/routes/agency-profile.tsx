import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { useResource } from '@/lib/use-resource'
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  FileField,
  LoadingState,
  PageHeader,
  TextArea,
} from '@/components/ui'
import { getAgency, updateAgency, uploadAgencyImage, type AgencyDraft } from '@/lib/crm/agency'

/**
 * Todo string, nunca null: un <input> controlado con `value={null}` se vuelve
 * no controlado y React avisa. `Agency` sí usa null porque es lo que manda la
 * API; la conversión pasa una sola vez, al cargar.
 */
type AgencyForm = Record<keyof Required<AgencyDraft>, string>

const EMPTY: AgencyForm = {
  name: '',
  rnc: '',
  phone: '',
  email: '',
  website: '',
  description: '',
  instagram: '',
  facebook: '',
}

/**
 * La ficha de la agencia.
 *
 * Lectura para cualquier miembro activo —un asesor necesita ver bajo qué marca
 * trabaja—; escritura solo para owner/admin, que es lo que el servidor impone
 * y `is_admin` permite reflejar sin tener que provocar un 403.
 *
 * `is_verified` no se edita aquí ni existe una ruta para hacerlo: la
 * verificación la concede el panel de administración.
 */
export function AgencyProfilePage() {
  const { t } = useI18n()
  const toast = useToast()
  const [nonce, setNonce] = useState(0)
  const profile = useResource((signal) => getAgency(signal), [nonce])

  const [draft, setDraft] = useState<AgencyForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  const loaded = profile.status === 'ready' ? profile.data.agency : null
  useEffect(() => {
    if (loaded === null) return
    setDraft({
      name: loaded.name ?? '',
      rnc: loaded.rnc ?? '',
      phone: loaded.phone ?? '',
      email: loaded.email ?? '',
      website: loaded.website ?? '',
      description: loaded.description ?? '',
      instagram: loaded.instagram ?? '',
      facebook: loaded.facebook ?? '',
    })
  }, [loaded])

  if (profile.status === 'loading') return <LoadingState label={t('agency.loading')} />
  if (profile.status === 'error') {
    return <ErrorState message={profile.message} onRetry={profile.reload} retryLabel={t('common.retry')} />
  }

  const { agency, is_admin: canEdit } = profile.data
  const set = (key: keyof AgencyDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      await updateAgency(draft)
      setNonce((n) => n + 1)
    } catch (caught: unknown) {
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setSaving(false)
    }
  }

  const upload = async (kind: 'logo' | 'cover', files: File[]) => {
    const file = files[0]
    if (file === undefined) return

    try {
      await uploadAgencyImage(kind, file)
      setNonce((n) => n + 1)
    } catch (caught: unknown) {
      // Una subida rechazada deja la imagen anterior intacta en el servidor, así
      // que recargar no es necesario — pero el motivo sí hay que enseñarlo.
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    }
  }

  return (
    <div>
      <PageHeader
        title={t('agencyProfile.title')}
        subtitle={t('agencyProfile.subtitle')}
        actions={agency.is_verified ? <Badge tone="success">{t('agencyProfile.verified')}</Badge> : undefined}
      />

      {!canEdit && (
        <Card className="mb-4 p-3 text-sm text-muted">{t('agencyProfile.readOnly')}</Card>
      )}

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="agency-name" label={t('agencyProfile.name')} value={draft.name} onChange={set('name')} disabled={!canEdit} />
          <Field id="agency-rnc" label={t('agencyProfile.rnc')} value={draft.rnc} onChange={set('rnc')} disabled={!canEdit} />
          <Field id="agency-phone" label={t('agencyProfile.phone')} value={draft.phone} onChange={set('phone')} type="tel" disabled={!canEdit} />
          <Field id="agency-email" label={t('agencyProfile.email')} value={draft.email} onChange={set('email')} type="email" disabled={!canEdit} />
          <Field id="agency-website" label={t('agencyProfile.website')} value={draft.website} onChange={set('website')} disabled={!canEdit} />
          <Field id="agency-instagram" label={t('agencyProfile.instagram')} value={draft.instagram} onChange={set('instagram')} disabled={!canEdit} />
          <Field id="agency-facebook" label={t('agencyProfile.facebook')} value={draft.facebook} onChange={set('facebook')} disabled={!canEdit} />
        </div>

        <div className="mt-4">
          <TextArea
            id="agency-description"
            label={t('agencyProfile.description')}
            value={draft.description}
            onChange={set('description')}
            disabled={!canEdit}
          />
        </div>

        {canEdit && (
          <div className="mt-4 flex justify-end">
            <Button variant="primary" state={saving ? 'loading' : 'idle'} onClick={() => void save()}>
              {t('agencyProfile.save')}
            </Button>
          </div>
        )}
      </Card>

      {canEdit && (
        <Card className="mt-4 grid gap-4 p-4 sm:grid-cols-2">
          {/*
            Rutas propias, no campos del formulario de arriba: un formulario
            obligado a reenviar cada campo de texto para pasar la validación es
            como una pantalla desactualizada pisa datos que nadie tocó.

            Solo raster — el SVG está bloqueado en toda la plataforma.
          */}
          <div>
            {agency.logo !== null && (
              <img src={agency.logo} alt="" className="mb-2 h-16 w-16 rounded object-cover" />
            )}
            <FileField
              id="agency-logo"
              label={t('agencyProfile.logo')}
              accept="image/jpeg,image/png,image/webp"
              files={[]}
              onChange={(files) => void upload('logo', files)}
            />
          </div>
          <div>
            {agency.cover !== null && (
              <img src={agency.cover} alt="" className="mb-2 h-16 w-full rounded object-cover" />
            )}
            <FileField
              id="agency-cover"
              label={t('agencyProfile.cover')}
              accept="image/jpeg,image/png,image/webp"
              files={[]}
              onChange={(files) => void upload('cover', files)}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
