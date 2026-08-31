import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useResource } from '@/lib/use-resource'
import { Card, EmptyState, ErrorState, LoadingState, Select } from '@/components/ui'
import {
  ACTIVITY_ACTIONS,
  listActivity,
  type ActivityAction,
  type AgencyActivityEntry,
  type AgencyMember,
} from '@/lib/crm/agency'

/**
 * La pestaña Actividad: quién tocó qué, y qué cambió exactamente.
 *
 * Solo se monta para owner/admin. El servidor vuelve a comprobarlo —el feed
 * dice lo que hacen los compañeros de uno— así que ocultar la pestaña es
 * comodidad, no la puerta.
 *
 * Los miembros llegan por prop y no se vuelven a pedir: la página ya cargó el
 * equipo para la pestaña de al lado, y una segunda llamada aquí solo serviría
 * para que las dos listas pudieran discrepar.
 */
export function AgencyActivity({ members }: { members: AgencyMember[] }) {
  const { t, formatDate } = useI18n()
  const [actor, setActor] = useState<number | null>(null)
  const [action, setAction] = useState<ActivityAction | null>(null)

  const feed = useResource(
    (signal) =>
      listActivity(
        { actor_id: actor ?? undefined, action: action ?? undefined, limit: 50 },
        signal,
      ),
    [actor, action],
  )

  // El Select del proyecto lleva su propia etiqueta y devuelve el valor ya
  // desempaquetado; `''` es "sin filtro" en los dos.
  const filters = (
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <Select
        id="activity-member"
        label={t('agency.activity.byMember')}
        value={actor === null ? '' : String(actor)}
        onChange={(value) => setActor(value === '' ? null : Number(value))}
        options={[
          { value: '', label: t('agency.activity.allMembers') },
          ...members.map((member) => ({
            value: String(member.customer_id),
            label: member.name ?? String(member.customer_id),
          })),
        ]}
      />

      <Select
        id="activity-action"
        label={t('agency.activity.byAction')}
        value={action ?? ''}
        onChange={(value) => setAction(value === '' ? null : (value as ActivityAction))}
        options={[
          { value: '', label: t('agency.activity.allActions') },
          ...ACTIVITY_ACTIONS.map((option) => ({
            value: option,
            label: t(`agency.activity.action.${option}`),
          })),
        ]}
      />
    </div>
  )

  if (feed.status === 'loading') {
    return (
      <>
        {filters}
        <LoadingState label={t('agency.activity.loading')} />
      </>
    )
  }

  if (feed.status === 'error') {
    return (
      <>
        {filters}
        <ErrorState message={feed.message} onRetry={feed.reload} retryLabel={t('common.retry')} />
      </>
    )
  }

  const { entries } = feed.data

  return (
    <>
      {filters}

      {entries.length === 0 ? (
        // Dos vacíos distintos: una agencia recién creada no ha hecho nada
        // todavía, y un filtro que no encuentra nada es un callejón del que hay
        // que saber salir. Decirle "aún no hay actividad" a quien acaba de
        // filtrar le hace pensar que el registro está roto.
        <EmptyState
          title={
            actor !== null || action !== null
              ? t('agency.activity.emptyFiltered')
              : t('agency.activity.empty')
          }
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm text-ink">
                    <span className="font-medium">
                      {entry.actor_name ?? t('agency.activity.system')}
                    </span>{' '}
                    {t(`agency.activity.action.${entry.action}`).toLocaleLowerCase()}{' '}
                    <span className="font-medium">{entry.subject_label}</span>
                  </p>
                  {entry.created_at !== null && (
                    <time dateTime={entry.created_at} className="text-xs text-muted">
                      {formatDate(entry.created_at)}
                    </time>
                  )}
                </div>

                <Diff changes={entry.changes} />
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

/**
 * El detalle campo por campo, plegado.
 *
 * `<details>` y no un estado propio: el navegador ya trae el plegado con su
 * teclado y su semántica, y cada entrada tendría que llevar el suyo.
 *
 * Sin esto el feed dice que alguien editó una propiedad; con esto dice que
 * bajó el precio de 180.000 a 165.000, que es la diferencia entre un registro
 * y algo que el propietario lee de verdad.
 */
function Diff({ changes }: { changes: AgencyActivityEntry['changes'] }) {
  const { t } = useI18n()
  const fields = Object.entries(changes ?? {})

  if (fields.length === 0) return null

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted hover:text-ink">
        {t('agency.activity.detail')}
      </summary>
      <dl className="mt-2 flex flex-col gap-1 text-xs">
        {fields.map(([field, change]) => (
          <div key={field} className="flex flex-wrap gap-x-2">
            <dt className="text-muted">{field}</dt>
            <dd className="text-ink-2">
              <s className="text-muted">{formatValue(change.from)}</s> → {formatValue(change.to)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/** Un vacío tiene que verse: sin esto "" y null se pintan como nada. */
function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === '') return '—'

  return String(value)
}
