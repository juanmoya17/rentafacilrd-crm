import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button, Field, Modal, Select, type SelectOption } from '@/components/ui'
import { useResource } from '@/lib/use-resource'
import { listContacts } from '@/lib/crm/api'
import {
  UNIT_STATUSES,
  createTypology,
  createUnitBatch,
  toNumberOrNull,
  updateTypology,
  updateUnit,
  validateTypology,
  type CrmTypology,
  type CrmUnit,
  type TypologyField,
  type TypologyForm,
  type UnitStatus,
} from '@/lib/crm/projects'

/**
 * The three write flows of M8 phase 5b, each in a native `<dialog>`.
 *
 * They share one posture: client validation is convenience, the server rule
 * is the boundary, and whatever the server says comes back verbatim. The
 * range generator in particular refuses with the exact reason (mismatched
 * prefix, mismatched padding width, descending range, over 200) and replacing
 * that with a generic "invalid range" would delete the only clue.
 */

/** Server messages land here as sent. Never paraphrased, never swallowed. */
function FormError({ message }: { message: string | null }) {
  if (message === null) return null

  return (
    <p role="alert" className="mt-3 text-xs text-error">
      {message}
    </p>
  )
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/* --------------------------------------------------------------- typology */

const EMPTY: TypologyForm = {
  title: '',
  bedrooms: '',
  bathrooms: '',
  area: '',
  base_price: '',
  sort_order: '',
}

/** Null stays empty, never "0": a typology with no area has missing data, and
 *  a prefilled zero would turn the next save into a claim it never made. */
function formOf(typology: CrmTypology | null): TypologyForm {
  if (typology === null) return EMPTY

  return {
    title: typology.title,
    bedrooms: typology.bedrooms === null ? '' : String(typology.bedrooms),
    bathrooms: typology.bathrooms === null ? '' : String(typology.bathrooms),
    area: typology.area ?? '',
    base_price: typology.base_price ?? '',
    sort_order: String(typology.sort_order),
  }
}

export function TypologyDialog({
  projectId,
  typology,
  onClose,
  onSaved,
}: {
  projectId: number
  /** Null creates. Anything else edits that row. */
  typology: CrmTypology | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<TypologyForm>(() => formOf(typology))
  const [invalid, setInvalid] = useState<TypologyField | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (field: TypologyField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    // Clearing on edit rather than on submit: an error that outlives the
    // keystroke fixing it reads as the field still being wrong.
    if (invalid === field) setInvalid(null)
  }

  const submit = async () => {
    const offending = validateTypology(form)
    if (offending !== null) {
      setInvalid(offending)
      return
    }

    setSaving(true)
    setError(null)

    const input = {
      title: form.title.trim(),
      bedrooms: toNumberOrNull(form.bedrooms),
      bathrooms: toNumberOrNull(form.bathrooms),
      area: toNumberOrNull(form.area),
      base_price: toNumberOrNull(form.base_price),
      // The column is not nullable; an emptied order means "unordered", which
      // is what 0 means to the server's sort_order-then-id ordering.
      sort_order: toNumberOrNull(form.sort_order) ?? 0,
    }

    try {
      if (typology === null) {
        await createTypology(projectId, input)
      } else {
        await updateTypology(projectId, typology.id, input)
      }
      onSaved()
    } catch (caught: unknown) {
      setError(messageOf(caught, t('error.generic')))
      setSaving(false)
    }
  }

  const numeric = (field: TypologyField, label: string, mode: 'numeric' | 'decimal') => (
    <Field
      id={`typology-${field}`}
      label={label}
      value={form[field]}
      onChange={(value) => set(field, value)}
      inputMode={mode}
      state={invalid === field ? 'error' : 'idle'}
      error={t(`typology.error.${field}`)}
      disabled={saving}
    />
  )

  return (
    <Modal
      title={t(typology === null ? 'projectDetail.newTypology' : 'projectDetail.editTypology')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            state={saving ? 'loading' : 'idle'}
            onClick={() => void submit()}
          >
            {t(saving ? 'common.saving' : 'common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field
          id="typology-title"
          label={t('typology.name')}
          value={form.title}
          onChange={(value) => set('title', value)}
          state={invalid === 'title' ? 'error' : 'idle'}
          error={t('typology.error.title')}
          disabled={saving}
          required
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {numeric('bedrooms', t('common.bedrooms'), 'numeric')}
          {numeric('bathrooms', t('common.bathrooms'), 'numeric')}
          {numeric('area', t('common.area'), 'decimal')}
          {numeric('base_price', t('common.price'), 'decimal')}
        </div>

        {numeric('sort_order', t('typology.sortOrder'), 'numeric')}
      </div>

      <FormError message={error} />
    </Modal>
  )
}

/* ------------------------------------------------------------ unit batch */

/** `sold` is absent by construction: neither create path writes
 *  sold_by/sold_at, so a unit born sold would be a closed sale with no buyer. */
const CREATABLE = UNIT_STATUSES.filter((status) => status !== 'sold')

export function UnitBatchDialog({
  projectId,
  typologies,
  onClose,
  onCreated,
}: {
  projectId: number
  typologies: CrmTypology[]
  onClose: () => void
  onCreated: (result: { created: number; skipped: number }) => void
}) {
  const { t } = useI18n()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [typologyId, setTypologyId] = useState('')
  const [floor, setFloor] = useState('')
  const [price, setPrice] = useState('')
  const [status, setStatus] = useState<string>('available')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const typologyOptions: SelectOption[] = [
    { value: '', label: t('projectDetail.unclassified') },
    ...typologies.map((typology) => ({ value: String(typology.id), label: typology.title })),
  ]

  const submit = async () => {
    if (from.trim() === '' || to.trim() === '') {
      setError(t('units.error.range'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const result = await createUnitBatch(projectId, {
        from: from.trim(),
        to: to.trim(),
        typology_id: typologyId === '' ? null : Number(typologyId),
        floor: floor.trim() === '' ? null : floor.trim(),
        price: toNumberOrNull(price),
        status: status as Exclude<UnitStatus, 'sold'>,
      })
      onCreated(result)
    } catch (caught: unknown) {
      // The generator's refusals name the reason. Show that, not a rewrite.
      setError(messageOf(caught, t('error.generic')))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('projectDetail.generateUnits')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            state={saving ? 'loading' : 'idle'}
            onClick={() => void submit()}
          >
            {t(saving ? 'common.saving' : 'common.create')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="batch-from"
            label={t('units.from')}
            value={from}
            onChange={setFrom}
            placeholder="301"
            disabled={saving}
            required
          />
          <Field
            id="batch-to"
            label={t('units.to')}
            value={to}
            onChange={setTo}
            placeholder="312"
            disabled={saving}
            required
          />
        </div>
        <p className="-mt-1 text-xs text-muted">{t('units.rangeHint')}</p>

        <Select
          id="batch-typology"
          label={t('projects.typologies')}
          value={typologyId}
          onChange={setTypologyId}
          options={typologyOptions}
          disabled={saving}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {/* A string, not a number: "PB", "Mezzanine" and "PH" are real floors. */}
          <Field
            id="batch-floor"
            label={t('projectDetail.floor')}
            value={floor}
            onChange={setFloor}
            placeholder="PB"
            disabled={saving}
          />
          <Field
            id="batch-price"
            label={t('units.optionalPrice')}
            value={price}
            onChange={setPrice}
            inputMode="decimal"
            disabled={saving}
          />
        </div>

        <Select
          id="batch-status"
          label={t('common.status')}
          value={status}
          onChange={setStatus}
          options={CREATABLE.map((option) => ({
            value: option,
            label: t(`unitStatus.${option}`),
          }))}
          disabled={saving}
        />
      </div>

      <FormError message={error} />
    </Modal>
  )
}

/* ------------------------------------------------------------- sale close */

export function UnitStatusDialog({
  projectId,
  units,
  unit,
  onClose,
  onSaved,
}: {
  projectId: number
  units: CrmUnit[]
  /** Null opens the sale-close path: pick from what is still for sale. A unit
   *  opens the correction path, which is the only way back out of `sold`. */
  unit: CrmUnit | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const sellable = units.filter((candidate) => candidate.status === 'available')
  const initial = unit ?? sellable[0] ?? null

  const [unitId, setUnitId] = useState<string>(initial === null ? '' : String(initial.id))
  const [status, setStatus] = useState<string>(unit === null ? 'sold' : unit.status)
  const [buyer, setBuyer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Only contacts with an app account can be the buyer: sold_by is a foreign
  // key onto customers, so a contact typed in by hand has nothing to point at.
  const contacts = useResource((signal) => listContacts({ limit: 100 }, signal), [])
  const buyers =
    contacts.status === 'ready'
      ? contacts.data.items.filter((contact) => contact.customer_id !== null)
      : []

  const selected = units.find((candidate) => String(candidate.id) === unitId) ?? null
  const selling = status === 'sold'
  const clearsBuyer = selected?.status === 'sold' && !selling

  const submit = async () => {
    if (selected === null) return
    if (selling && buyer === '') {
      setError(t('units.error.buyer'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateUnit(projectId, selected.id, {
        status: status as UnitStatus,
        ...(selling ? { sold_by: Number(buyer) } : {}),
      })
      onSaved()
    } catch (caught: unknown) {
      setError(messageOf(caught, t('error.generic')))
      setSaving(false)
    }
  }

  const unitOptions: SelectOption[] = (unit === null ? sellable : [unit]).map((option) => ({
    value: String(option.id),
    label:
      option.floor === null
        ? option.identifier
        : `${option.identifier} · ${t('projectDetail.floor')} ${option.floor}`,
  }))

  const nothingToSell = unit === null && sellable.length === 0

  return (
    <Modal
      title={t('projectDetail.closeSale')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        nothingToSell ? (
          <Button onClick={onClose}>{t('common.close')}</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              state={saving ? 'loading' : 'idle'}
              disabled={selected === null || (selling && buyers.length === 0)}
              onClick={() => void submit()}
            >
              {t(saving ? 'common.saving' : 'common.save')}
            </Button>
          </>
        )
      }
    >
      {nothingToSell ? (
        <p className="text-sm text-ink-2">{t('units.noAvailable')}</p>
      ) : (
        <div className="grid gap-3">
          <Select
            id="unit-pick"
            label={t('units.pickUnit')}
            value={unitId}
            onChange={setUnitId}
            options={unitOptions}
            disabled={saving || unit !== null}
          />

          <Select
            id="unit-status"
            label={t('common.status')}
            value={status}
            onChange={setStatus}
            options={UNIT_STATUSES.map((option) => ({
              value: option,
              label: t(`unitStatus.${option}`),
            }))}
            disabled={saving}
          />

          {clearsBuyer && (
            <p className="rounded-md border border-warning bg-warning-bg px-3 py-2 text-xs text-warning">
              {t('units.clearsBuyer')}
            </p>
          )}

          {selling && (
            <>
              {contacts.status === 'loading' && (
                <p className="text-xs text-muted">{t('common.loading')}</p>
              )}
              {contacts.status === 'error' && (
                <p role="alert" className="text-xs text-error">
                  {contacts.message}
                </p>
              )}
              {contacts.status === 'ready' &&
                (buyers.length === 0 ? (
                  <p className="rounded-md border border-warning bg-warning-bg px-3 py-2 text-xs text-warning">
                    {t('units.noBuyers')}
                  </p>
                ) : (
                  <>
                    <Select
                      id="unit-buyer"
                      label={t('units.buyer')}
                      value={buyer}
                      onChange={setBuyer}
                      options={[
                        { value: '', label: t('common.none') },
                        ...buyers.map((contact) => ({
                          value: String(contact.customer_id),
                          label:
                            contact.phone === null
                              ? contact.name
                              : `${contact.name} · ${contact.phone}`,
                        })),
                      ]}
                      helper={t('units.buyerHint')}
                      disabled={saving}
                    />
                    {/* No pager on a picker: say what is missing instead of
                        implying the list is everyone. */}
                    {contacts.data.total > contacts.data.items.length && (
                      <p className="-mt-1 text-xs text-muted">
                        {t('units.contactsShown', {
                          shown: contacts.data.items.length,
                          total: contacts.data.total,
                        })}
                      </p>
                    )}
                  </>
                ))}
            </>
          )}
        </div>
      )}

      <FormError message={error} />
    </Modal>
  )
}
