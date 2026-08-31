import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { Button, Field, Modal, Select } from '@/components/ui'
import {
  CONTRACT_TYPES,
  MIN_SEARCH,
  createShare,
  searchCollaborators,
  type CollaboratorOption,
  type ContractType,
} from '@/lib/crm/shares'

/**
 * Compartir una propiedad con otro agente.
 *
 * Quien lo abre ya puede editar el anuncio —la página no ofrece el disparador
 * si no—, y el servidor lo vuelve a comprobar: compartir es la regla de Editar
 * de la matriz, sin excepción nueva.
 *
 * La colaboración nace `pending`: esto no concede acceso a nada, manda un
 * contrato a firmar. El texto del botón lo dice para que nadie crea que acaba
 * de dar permisos.
 */
export function SharePropertyDialog({
  propertyId,
  onClose,
  onShared,
}: {
  propertyId: number
  onClose: () => void
  onShared: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [term, setTerm] = useState('')
  const [options, setOptions] = useState<CollaboratorOption[]>([])
  const [collaboratorId, setCollaboratorId] = useState<number | null>(null)
  const [contractType, setContractType] = useState<ContractType>('co_brokerage')
  const [commission, setCommission] = useState('50')
  const [busy, setBusy] = useState(false)

  // El servidor responde 422 con menos de dos caracteres, así que no se le
  // pregunta antes de tenerlos. Con debounce: cada tecla es una consulta.
  useEffect(() => {
    if (term.trim().length < MIN_SEARCH) {
      setOptions([])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchCollaborators(term.trim(), controller.signal)
        .then(setOptions)
        // Abortada o fallida: la lista se queda como está. Un toast por cada
        // pulsación mientras se escribe sería peor que el silencio.
        .catch(() => {})
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term])

  const pct = Number(commission)
  const validPct = commission.trim() !== '' && Number.isFinite(pct) && pct >= 0 && pct <= 100
  const canSubmit = collaboratorId !== null && validPct && !busy

  const submit = async () => {
    if (collaboratorId === null || !validPct) return

    setBusy(true)
    try {
      await createShare({
        property_id: propertyId,
        collaborator_id: collaboratorId,
        contract_type: contractType,
        commission_pct: pct,
      })
      onShared()
      onClose()
    } catch (caught: unknown) {
      // El mensaje del servidor tal cual: aquí viajan "ya tienes una
      // colaboración viva con esa persona" y "otro aceptó la exclusiva", que
      // un genérico volvería invisibles.
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('share.title')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={!canSubmit}
            state={busy ? 'loading' : 'idle'}
          >
            {t('share.submit')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field
          id="share-search"
          label={t('share.searchAgent')}
          value={term}
          onChange={setTerm}
          type="search"
          helper={t('share.searchHelp')}
        />

        <Select
          id="share-collaborator"
          label={t('share.collaborator')}
          value={collaboratorId === null ? '' : String(collaboratorId)}
          onChange={(value) => setCollaboratorId(value === '' ? null : Number(value))}
          disabled={options.length === 0}
          options={[
            {
              value: '',
              label:
                term.trim().length < MIN_SEARCH
                  ? t('share.searchFirst')
                  : options.length === 0
                    ? t('share.noAgents')
                    : t('share.pickAgent'),
            },
            ...options.map((option) => ({
              value: String(option.id),
              // La empresa va en la etiqueta: dos agentes pueden llamarse
              // igual, y firmar con el que no era no tiene deshacer.
              label: `${option.name ?? option.id}${option.agency_name ? ` · ${option.agency_name}` : ''}`,
            })),
          ]}
        />

        <Select
          id="share-type"
          label={t('share.contractType')}
          value={contractType}
          onChange={(value) => setContractType(value as ContractType)}
          options={CONTRACT_TYPES.map((type) => ({
            value: type,
            label: t(`share.type.${type}`),
          }))}
          helper={t(`share.typeHelp.${contractType}`)}
        />

        <Field
          id="share-commission"
          label={t('share.commission')}
          value={commission}
          onChange={setCommission}
          inputMode="decimal"
          invalid={commission.trim() !== '' && !validPct}
          error={commission.trim() !== '' && !validPct ? t('share.commissionRange') : undefined}
        />

        <p className="text-xs text-muted">{t('share.pendingNote')}</p>
      </div>
    </Modal>
  )
}
