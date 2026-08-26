import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { useResource } from '@/lib/use-resource'
import { Badge, Button, Card, ErrorState, LoadingState } from '@/components/ui'
import {
  MAX_CLAIM,
  claimKey,
  claimListings,
  listClaimable,
  type ClaimableListing,
} from '@/lib/crm/agency'

/**
 * Los anuncios que alguien del equipo trajo consigo.
 *
 * Aceptar una invitación no mueve inventario: se queda en la agencia de origen,
 * que ya no tiene miembros, y hasta que se incorpora aquí no lo ve nadie. Esta
 * es la única pantalla que los enseña — el listado de inventario filtra por
 * `agency_id` y por definición no puede verlos.
 *
 * Solo se monta cuando hay algo que incorporar: un estado vacío permanente sería
 * ruido en todas las agencias que no tienen nada pendiente.
 */
export function ClaimListings({ onClaimed }: { onClaimed: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [nonce, setNonce] = useState(0)
  const resource = useResource((signal) => listClaimable({ limit: MAX_CLAIM }, signal), [nonce])

  // Por clave `tipo:id`, no por id: la lista mezcla propiedades y proyectos y
  // los dos numeran por separado.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Memoizado: sin esto el `[]` del caso "cargando" es un array nuevo en cada
  // render y el efecto de abajo se dispara en todos.
  const items = useMemo(
    () => (resource.status === 'ready' ? resource.data.items : []),
    [resource],
  )

  // Si un anuncio deja de estar en la lista —lo incorporó otro admin— su clave
  // no puede quedarse en la selección: el lote es todo-o-nada y el servidor
  // rechazaría los demás por culpa de uno que ya no está.
  //
  // Solo con la lista YA cargada. Durante una recarga `items` está vacío, y
  // podar contra esa lista borraría una selección que el usuario acaba de
  // hacer.
  useEffect(() => {
    if (resource.status !== 'ready') return

    setSelected((current) => {
      if (current.size === 0) return current
      const alive = new Set(items.map(claimKey))
      const next = new Set([...current].filter((key) => alive.has(key)))

      return next.size === current.size ? current : next
    })
  }, [items, resource.status])

  if (resource.status === 'loading') return <LoadingState label={t('agency.loading')} />
  if (resource.status === 'error') {
    return <ErrorState message={resource.message} onRetry={resource.reload} retryLabel={t('common.retry')} />
  }
  // Nada que incorporar: la sección no existe.
  if (items.length === 0) return null

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)

      return next
    })

  const allShown = items.length > 0 && items.every((item) => selected.has(claimKey(item)))

  const toggleAll = () =>
    setSelected((current) => {
      if (allShown) return new Set()
      // Solo lo que está en pantalla. No hay "seleccionar todo lo que coincide":
      // incorporar en bloque filas que nadie miró no debe estar a un clic.
      const next = new Set(current)
      items.forEach((item) => next.add(claimKey(item)))

      return next
    })

  const tooMany = selected.size > MAX_CLAIM

  const submit = async () => {
    if (!window.confirm(t('claim.confirm'))) return

    setBusy(true)
    try {
      await claimListings([...selected])
      setSelected(new Set())
      setNonce((n) => n + 1)
      onClaimed()
    } catch (caught: unknown) {
      // El mensaje del servidor: el rechazo del lote y la regla de
      // incorporables viajan en él.
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4 p-3">
      <h2 className="text-sm font-semibold text-ink">{t('claim.title')}</h2>
      <p className="mt-0.5 text-sm text-muted">{t('claim.hint')}</p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-rule text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={allShown}
                  onChange={toggleAll}
                  aria-label={t('claim.title')}
                />
              </th>
              <th className="px-3 py-2">{t('agency.col.member')}</th>
              <th className="px-3 py-2">{t('claim.owner')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: ClaimableListing) => {
              const key = claimKey(item)

              return (
                <tr key={key} className="border-b border-rule/60 last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.has(key)}
                      onChange={() => toggle(key)}
                      aria-label={item.title ?? key}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{t(`claim.type.${item.listing_type}`)}</Badge>
                      <span className="text-ink">{item.title ?? '—'}</span>
                    </div>
                    {item.city && <div className="text-xs text-muted">{item.city}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted">{item.owner ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3">
          <span className="text-sm text-muted">{t('claim.selected', { count: selected.size })}</span>

          <div className="flex items-center gap-2">
            {/* El motivo a la vista, nunca un botón muerto sin explicación:
                truncar 250 en silencio es el fallo que este tope existe para
                hacer visible. */}
            {tooMany && (
              <span className="text-sm text-muted">{t('claim.tooMany', { max: MAX_CLAIM })}</span>
            )}
            <Button onClick={() => setSelected(new Set())}>{t('claim.cancel')}</Button>
            <Button
              variant="primary"
              state={busy ? 'loading' : 'idle'}
              disabled={tooMany}
              onClick={() => void submit()}
            >
              {t('claim.action', { count: selected.size })}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
