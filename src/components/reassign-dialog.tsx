import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { Button, Modal, Select } from '@/components/ui'
import { reassignListing, type AgencyMember } from '@/lib/crm/agency'

/**
 * Reasigna una propiedad o un proyecto a otro miembro del equipo.
 *
 * Compartido entre /properties y /projects: lo único que cambia entre las
 * dos pantallas es `type`, y es lo único que viaja distinto a
 * `reassignListing`. Sigue la forma de `ExitDialog` (routes/agency.tsx) —
 * elegir a un compañero y confirmar — pero, a diferencia de ExitDialog y
 * TransferDialog (que delegan la mutación al `run()` de su página), este
 * diálogo hace su propia llamada, como ClaimListings: no hay una página
 * compartida entre /properties y /projects donde centralizar un `run()`.
 *
 * `receivers` nunca llega vacío: quien monta este diálogo ya comprobó
 * `reassignReceivers(...).length > 0` antes de ofrecer el disparador — un
 * desplegable sin opciones es una vía muerta.
 *
 * Termina en una pantalla de confirmación con el nombre de quien recibió el
 * anuncio en vez de cerrarse sola al confirmar. El resto de la app
 * deliberadamente no tiene un toast de éxito (toast-context.ts): si la fila
 * sigue en pantalla, verla cambiar ya es la confirmación. Aquí no alcanza —
 * si el listado tiene el filtro por asesor puesto, la fila reasignada
 * desaparece de la vista en cuanto recarga, y sin decir a quién se le
 * asignó eso se lee como que el anuncio se borró.
 */
export function ReassignDialog({
  type,
  id,
  listingTitle,
  receivers,
  onClose,
  onReassigned,
}: {
  type: 'property' | 'project'
  id: number
  listingTitle: string
  receivers: AgencyMember[]
  onClose: () => void
  /** El anuncio cambió de dueño — recarga el listado que lo muestra. */
  onReassigned: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [receiver, setReceiver] = useState(
    receivers[0] !== undefined ? String(receivers[0].customer_id) : '',
  )
  const [busy, setBusy] = useState(false)
  /** Nombre de quien recibió el anuncio, una vez el servidor confirmó. `null` = todavía eligiendo. */
  const [doneName, setDoneName] = useState<string | null>(null)

  const submit = async () => {
    const toCustomerId = Number(receiver)
    setBusy(true)
    try {
      await reassignListing(type, id, toCustomerId)
      onReassigned()
      const target = receivers.find((m) => m.customer_id === toCustomerId)
      setDoneName(target?.name ?? String(toCustomerId))
    } catch (caught: unknown) {
      // El mensaje del servidor: PropertyPolicy manda 403 si el rol cambió
      // bajo los pies, y bad_receiver si el destino dejó de ser válido entre
      // que se abrió el diálogo y se confirmó.
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  if (doneName !== null) {
    return (
      <Modal
        title={t('reassign.title', { title: listingTitle })}
        closeLabel={t('common.close')}
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t('common.close')}
          </Button>
        }
      >
        <p role="status" className="text-sm text-ink-2">
          {t('reassign.done', { name: doneName })}
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      title={t('reassign.title', { title: listingTitle })}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            state={busy ? 'loading' : 'idle'}
            disabled={receiver === ''}
            onClick={() => void submit()}
          >
            {t('reassign.confirm')}
          </Button>
        </div>
      }
    >
      <Select
        id="reassign-receiver"
        label={t('reassign.receiver')}
        value={receiver}
        onChange={setReceiver}
        options={receivers.map((member) => ({
          value: String(member.customer_id),
          label: member.name ?? String(member.customer_id),
        }))}
      />
    </Modal>
  )
}
