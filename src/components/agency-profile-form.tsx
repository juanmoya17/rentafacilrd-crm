import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { Badge, Button, Card, Field, FileField, TextArea } from '@/components/ui'
import { updateAgency, uploadAgencyImage, type Agency, type AgencyDraft } from '@/lib/crm/agency'

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
 * La ficha de la agencia — pestaña «Datos» de `/agency`.
 *
 * `agency` llega ya cargado por quien monta este componente: `getAgency()` se
 * pide una sola vez para toda la página, no aquí. Escritura solo para
 * owner/admin, que es lo que el servidor impone y `canEdit` permite reflejar
 * sin tener que provocar un 403.
 *
 * `is_verified` no se edita aquí ni existe una ruta para hacerlo: la
 * verificación la concede el panel de administración.
 */
export function AgencyProfileForm({
  agency,
  canEdit,
  onSaved,
}: {
  agency: Agency
  canEdit: boolean
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [draft, setDraft] = useState<AgencyForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft({
      name: agency.name ?? '',
      rnc: agency.rnc ?? '',
      phone: agency.phone ?? '',
      email: agency.email ?? '',
      website: agency.website ?? '',
      description: agency.description ?? '',
      instagram: agency.instagram ?? '',
      facebook: agency.facebook ?? '',
    })
  }, [agency])

  const set = (key: keyof AgencyDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      await updateAgency(draft)
      onSaved()
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
      onSaved()
    } catch (caught: unknown) {
      // Una subida rechazada deja la imagen anterior intacta en el servidor, así
      // que recargar no es necesario — pero el motivo sí hay que enseñarlo.
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    }
  }

  return (
    <div>
      {/* La pestaña ya dice "Datos", así que el título de la antigua pantalla
          sobraría aquí. El subtítulo no: es lo único que avisa de que esto se
          publica, y sin él el formulario parece configuración interna. */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-sm text-muted">{t('agencyProfile.subtitle')}</p>
        {agency.is_verified && <Badge tone="success">{t('agencyProfile.verified')}</Badge>}
      </div>

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
