import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { useResource } from '@/lib/use-resource'
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, Modal } from '@/components/ui'
import { SharePropertyDialog } from '@/components/share-property-dialog'
import {
  acceptShare,
  contractUrl,
  listCollaboratorLeads,
  listShares,
  rejectShare,
  revokeShare,
  type PropertyShare,
} from '@/lib/crm/shares'

/**
 * Las colaboraciones de un anuncio, desde su ficha.
 *
 * Una sola sección para las dos partes: quien comparte ve Revocar, quien
 * recibe ve Aceptar y Rechazar. Cuál toca lo dice `is_owner`, que resuelve el
 * servidor — reimplementar aquí la matriz de permisos es cómo las dos versiones
 * acaban discrepando.
 *
 * `canShare` lo decide la página: si el usuario no puede editar el anuncio, el
 * disparador no se pinta. El servidor lo vuelve a comprobar de todas formas.
 */
export function PropertyCollaborations({
  propertyId,
  canShare,
}: {
  propertyId: number
  canShare: boolean
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [nonce, setNonce] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [revoking, setRevoking] = useState<PropertyShare | null>(null)

  const shares = useResource(
    (signal) => listShares({ limit: 50 }, signal),
    [nonce],
  )

  const reload = () => setNonce((n) => n + 1)

  const run = async (action: () => Promise<void>) => {
    try {
      await action()
      reload()
    } catch (caught: unknown) {
      // El servidor explica por qué: "otro agente ya aceptó la exclusiva" es
      // la razón que el usuario necesita, y un genérico la borraría.
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    }
  }

  if (shares.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (shares.status === 'error') {
    return <ErrorState message={shares.message} onRetry={shares.reload} retryLabel={t('common.retry')} />
  }

  // El endpoint devuelve todas las mías; aquí solo interesan las de ESTE
  // anuncio. Filtrar en cliente y no pedir por propiedad mantiene una sola
  // llamada para una ficha que ya hace varias.
  const mine = shares.data.shares.filter((share) => share.property_id === propertyId)

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink-2">{t('share.section')}</h2>
        {canShare && (
          <Button onClick={() => setSharing(true)}>{t('share.trigger')}</Button>
        )}
      </div>

      {mine.length === 0 ? (
        <EmptyState title={t('share.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {mine.map((share) => (
            <li key={share.id}>
              <Card className="p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm font-medium text-ink">
                    {share.is_owner
                      ? (share.collaborator?.name ?? '—')
                      : (share.owner?.name ?? '—')}
                  </span>
                  <Badge>{t(`share.type.${share.contract_type}`)}</Badge>
                  <Badge>{t(`share.status.${share.status}`)}</Badge>
                  <span className="font-mono text-xs text-muted">{share.commission_pct}%</span>

                  <div className="ml-auto flex flex-wrap gap-2">
                    {/* Se abre en pestaña: la respuesta es un PDF, no la
                        envoltura JSON, y el navegador ya sabe enseñarlo. */}
                    <a
                      href={contractUrl(share.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-(--control-h) rounded-md border border-rule-2 px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-sunken"
                    >
                      {t('share.contract')}
                    </a>

                    {/* Aceptar y rechazar son de quien recibe; revocar, de
                        quien comparte. Y solo mientras siga viva. */}
                    {!share.is_owner && share.status === 'pending' && (
                      <>
                        <Button variant="primary" onClick={() => run(() => acceptShare(share.id))}>
                          {t('share.accept')}
                        </Button>
                        <Button onClick={() => run(() => rejectShare(share.id))}>
                          {t('share.reject')}
                        </Button>
                      </>
                    )}

                    {share.is_owner && (share.status === 'pending' || share.status === 'active') && (
                      <Button onClick={() => setRevoking(share)}>{t('share.revoke')}</Button>
                    )}
                  </div>
                </div>

                {share.revoked_reason !== null && (
                  <p className="mt-2 text-xs text-muted">{share.revoked_reason}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canShare && <CollaboratorLeads propertyId={propertyId} nonce={nonce} />}

      {sharing && (
        <SharePropertyDialog
          propertyId={propertyId}
          onClose={() => setSharing(false)}
          onShared={reload}
        />
      )}

      {revoking !== null && (
        <RevokeDialog
          share={revoking}
          onClose={() => setRevoking(null)}
          onDone={reload}
        />
      )}
    </section>
  )
}

/** El motivo es obligatorio y queda en el contrato, así que se pide, no se asume. */
function RevokeDialog({
  share,
  onClose,
  onDone,
}: {
  share: PropertyShare
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await revokeShare(share.id, reason.trim())
      onDone()
      onClose()
    } catch (caught: unknown) {
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('share.revokeTitle')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={reason.trim() === '' || busy}
            state={busy ? 'loading' : 'idle'}
          >
            {t('share.revokeConfirm')}
          </Button>
        </>
      }
    >
      <Field
        id="revoke-reason"
        label={t('share.revokeReason')}
        value={reason}
        onChange={setReason}
        helper={t('share.revokeHelp')}
        required
      />
    </Modal>
  )
}

/**
 * Los leads que los colaboradores captaron aquí. Solo lectura, y solo para
 * quien puede editar el anuncio: es el único punto donde alguien lee leads que
 * no son de su agencia, y el servidor lo acota igual.
 */
function CollaboratorLeads({ propertyId, nonce }: { propertyId: number; nonce: number }) {
  const { t } = useI18n()
  const leads = useResource((signal) => listCollaboratorLeads(propertyId, signal), [propertyId, nonce])

  if (leads.status !== 'ready' || leads.data.total === 0) return null

  return (
    <div className="mt-4">
      <h3 className="mb-1 text-sm font-medium text-ink-2">{t('share.collaboratorLeads')}</h3>
      <p className="mb-2 text-xs text-muted">{t('share.readOnly')}</p>

      <div className="flex flex-col gap-2">
        {leads.data.groups
          .filter((group) => group.leads.length > 0)
          .map((group) => (
            <Card key={group.collaborator_id} className="p-3">
              <p className="text-sm font-medium text-ink">{group.collaborator_name ?? '—'}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {group.leads.map((lead) => (
                  <li key={lead.id} className="flex items-center gap-2 text-sm text-ink-2">
                    <span>{lead.contact?.name ?? '—'}</span>
                    <Badge>{lead.stage}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
      </div>
    </div>
  )
}
