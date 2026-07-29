import { useEffect, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Card, ErrorState, LoadingState, PageHeader, ScoreDot } from '@/components/ui'
import { useResource } from '@/lib/use-resource'
import { listLeads, updateLeadStage } from '@/lib/crm/api'
import { STAGES, type CrmLead, type Stage } from '@/lib/crm/types'

export function PipelinePage() {
  const { t, formatRelativeTime } = useI18n()
  // One page big enough for a board; the list view is where volume is handled.
  const resource = useResource((signal) => listLeads({ limit: 100 }, signal), [])

  const [leads, setLeads] = useState<CrmLead[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  const loaded = resource.status === 'ready' ? resource.data : null
  useEffect(() => {
    if (loaded !== null) setLeads(loaded.items)
  }, [loaded])

  const drop = async (stage: Stage) => {
    setOver(null)
    const id = dragging
    setDragging(null)
    if (id === null) return

    const lead = leads.find((item) => item.id === id)
    if (lead === undefined || lead.stage === stage) return

    // Optimistic: the card lands where it was dropped immediately, and only
    // snaps back if the server refuses.
    const previous = lead.stage
    setLeads((current) =>
      current.map((item) => (item.id === id ? { ...item, stage } : item)),
    )
    setMoveError(null)

    try {
      const updated = await updateLeadStage(id, stage)
      setLeads((current) => current.map((item) => (item.id === id ? updated : item)))
    } catch {
      setLeads((current) =>
        current.map((item) => (item.id === id ? { ...item, stage: previous } : item)),
      )
      setMoveError(t('pipeline.moveFailed'))
    }
  }

  const allowDrop = (event: DragEvent, stage: Stage) => {
    event.preventDefault()
    setOver(stage)
  }

  return (
    <>
      <PageHeader
        title={t('pipeline.title')}
        subtitle={t('pipeline.subtitle')}
        actions={
          <Link
            to="/leads"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('pipeline.listView')}
          </Link>
        }
      />

      {moveError && (
        <p role="alert" className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {moveError}
        </p>
      )}

      {resource.status === 'loading' && <LoadingState label={t('common.loading')} />}

      {resource.status === 'error' && (
        <ErrorState
          message={resource.message}
          retryLabel={t('common.retry')}
          onRetry={resource.reload}
        />
      )}

      {resource.status === 'ready' && (
        // The board scrolls sideways inside this box; the page never does.
        <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
          <div className="flex min-w-max gap-3">
            {STAGES.map((stage) => {
              const column = leads.filter((lead) => lead.stage === stage)
              return (
                <section
                  key={stage}
                  aria-label={t(`stage.${stage}`)}
                  onDragOver={(event) => allowDrop(event, stage)}
                  onDragLeave={() => setOver((current) => (current === stage ? null : current))}
                  onDrop={() => void drop(stage)}
                  className={`w-64 shrink-0 rounded-lg p-1 transition-colors ${
                    over === stage ? 'bg-brand-50 ring-2 ring-brand-300' : ''
                  }`}
                >
                  <header className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-slate-700">{t(`stage.${stage}`)}</h2>
                    <span className="text-xs font-medium tabular-nums text-slate-400">
                      {column.length}
                    </span>
                  </header>

                  <div className="space-y-2">
                    {column.length === 0 && (
                      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                        {t('pipeline.emptyColumn')}
                      </p>
                    )}

                    {column.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDragging(lead.id)}
                        onDragEnd={() => setDragging(null)}
                        className={dragging === lead.id ? 'opacity-40' : ''}
                      >
                        <Link to={`/leads/${lead.id}`} className="block">
                          <Card className="cursor-grab p-3 transition-colors hover:border-brand-300 active:cursor-grabbing">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-tight text-slate-900">
                                {lead.contact?.name ?? '—'}
                              </p>
                              <ScoreDot score={lead.score} band={lead.score_band} />
                            </div>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {lead.property_title ?? t('common.none')}
                            </p>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <OriginTag origin={lead.origin} />
                              <span
                                className={`text-xs tabular-nums ${
                                  lead.is_sla_breached
                                    ? 'font-semibold text-red-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {lead.sla_due_at !== null && !lead.is_sla_breached
                                  ? `${t('common.sla')} ${formatRelativeTime(lead.sla_due_at)}`
                                  : lead.last_activity_at !== null
                                    ? formatRelativeTime(lead.last_activity_at)
                                    : ''}
                              </span>
                            </div>
                          </Card>
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

/** Small local tag: the board has no room for the full origin badge row. */
function OriginTag({ origin }: { origin: CrmLead['origin'] }) {
  const { t } = useI18n()
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
        origin === 'price_drop' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {t(`origin.${origin}`)}
    </span>
  )
}
