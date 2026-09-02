import { useEffect, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRightLeft, Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { Button, Card, ErrorState, LoadingState, Modal, PageHeader, ScoreDot } from '@/components/ui'
import { useToast } from '@/lib/toast-context'
import { useRecordMorph, useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { listLeads, updateLeadStage } from '@/lib/crm/api'
import { STAGES, type CrmLead, type Stage } from '@/lib/crm/types'

export function PipelinePage() {
  const { t, formatRelativeTime } = useI18n()
  const toast = useToast()
  const reveal = useRowReveal()
  // One page big enough for a board; the list view is where volume is handled.
  const resource = useResource((signal) => listLeads({ limit: 100 }, signal), [])

  const [leads, setLeads] = useState<CrmLead[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  /** The lead whose stage sheet is open. Touch's answer to dragging. */
  const [moving, setMoving] = useState<CrmLead | null>(null)

  const loaded = resource.status === 'ready' ? resource.data : null
  useEffect(() => {
    if (loaded !== null) setLeads(loaded.items)
  }, [loaded])

  const move = async (id: number, stage: Stage, from: Stage, viaSheet = false) => {
    // Optimistic: the card lands where it was dropped immediately, and only
    // snaps back if the server refuses.
    setLeads((current) => current.map((item) => (item.id === id ? { ...item, stage } : item)))

    try {
      const updated = await updateLeadStage(id, stage)
      setLeads((current) => current.map((item) => (item.id === id ? updated : item)))
      // Only when the sheet was the gesture. A drag explains itself — the card
      // is under the finger that dropped it — and confirming that would be the
      // noise toast-context warns about. A tap on a row in a sheet does not,
      // and Undo needs somewhere to live.
      if (viaSheet) {
        toast.notify(t('pipeline.moved', { stage: t(`stage.${stage}`) }), {
          label: t('common.undo'),
          run: () => void move(id, from, stage, false),
        })
      }
    } catch {
      setLeads((current) =>
        current.map((item) => (item.id === id ? { ...item, stage: from } : item)),
      )
      // The card visibly flies back to the column it came from. Without this the
      // agent sees their drag undo itself and reads it as the board glitching,
      // not as the server refusing — which is why an inline paragraph at the top
      // of the page was the wrong surface for it.
      toast.fail(t('pipeline.moveFailed'), {
        label: t('common.retry'),
        run: () => void move(id, stage, from, viaSheet),
      })
    }
  }

  const drop = (stage: Stage) => {
    setOver(null)
    const id = dragging
    setDragging(null)
    if (id === null) return

    const lead = leads.find((item) => item.id === id)
    if (lead === undefined || lead.stage === stage) return
    void move(id, stage, lead.stage)
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
          <Link to="/leads" viewTransition>
            <Button>{t('pipeline.listView')}</Button>
          </Link>
        }
      />

      {resource.status === 'loading' && <LoadingState label={t('common.loading')} />}

      {resource.status === 'error' && (
        <ErrorState
          message={resource.message}
          retryLabel={t('common.retry')}
          onRetry={resource.reload}
        />
      )}

      {moving !== null && (
        <Modal
          variant="sheet"
          title={moving.contact?.name ?? t('common.none')}
          closeLabel={t('common.close')}
          onClose={() => setMoving(null)}
        >
          <p className="mb-3 text-sm text-muted">
            {moving.property_title ?? t('common.none')}
          </p>

          <ul className="grid gap-1">
            {STAGES.map((stage) => {
              const current = stage === moving.stage

              return (
                <li key={stage}>
                  <button
                    type="button"
                    disabled={current}
                    onClick={() => {
                      void move(moving.id, stage, moving.stage, true)
                      setMoving(null)
                    }}
                    className="flex min-h-14 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-base transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent"
                  >
                    {t(`stage.${stage}`)}
                    {current && <Check aria-hidden="true" className="size-4 shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </Modal>
      )}

      {resource.status === 'ready' && (
        // The board scrolls sideways inside this box; the page never does.
        /* snap-x: the board scrolls sideways, and without snapping a phone
           leaves you parked between two columns reading half of each. */
        <div className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
          <div className="flex min-w-max gap-3">
            {STAGES.map((stage, columnIndex) => {
              const column = leads.filter((lead) => lead.stage === stage)
              const isTarget = over === stage

              return (
                <section
                  key={stage}
                  aria-label={t(`stage.${stage}`)}
                  onDragOver={(event) => allowDrop(event, stage)}
                  onDragLeave={() =>
                    setOver((current) => (current === stage ? null : current))
                  }
                  onDrop={() => drop(stage)}
                  /* 85vw leaves the next column visibly peeking, which is the
                     only cue that the board continues past the edge. */
                  className={`w-[85vw] max-w-64 shrink-0 snap-start rounded-lg border border-dashed p-1 transition-colors duration-(--duration-base) ease-out sm:w-64 ${
                    isTarget ? 'border-accent bg-brand-50' : 'border-transparent'
                  }`}
                >
                  <header className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-ink-2">{t(`stage.${stage}`)}</h2>
                    <span className="font-mono text-xs font-medium text-muted">
                      {column.length}
                    </span>
                  </header>

                  <div className="space-y-2">
                    {column.length === 0 && (
                      <p className="rounded-lg border border-dashed border-rule-2 px-3 py-6 text-center text-xs text-muted">
                        {t('pipeline.emptyColumn')}
                      </p>
                    )}

                    {/* `layout` is what makes a dropped card travel to its new
                        column instead of disappearing from one and appearing in
                        the other — and it is the same movement that plays in
                        reverse when the server refuses the move. */}
                    <AnimatePresence initial={false}>
                      {column.map((lead, index) => (
                        <BoardCard
                          key={lead.id}
                          lead={lead}
                          dragging={dragging === lead.id}
                          onDragStart={() => setDragging(lead.id)}
                          onDragEnd={() => setDragging(null)}
                          onMove={() => setMoving(lead)}
                          reveal={reveal(columnIndex * 2 + index)}
                          formatRelativeTime={formatRelativeTime}
                        />
                      ))}
                    </AnimatePresence>
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

function BoardCard({
  lead,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  reveal,
  formatRelativeTime,
}: {
  lead: CrmLead
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: () => void
  reveal: Record<string, unknown>
  formatRelativeTime: (value: string) => string
}) {
  const { t } = useI18n()
  const to = `/leads/${lead.id}`
  const morph = useRecordMorph(to)

  return (
    <motion.div
      layout
      {...reveal}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      /* The dragged card stays visible at 45% rather than being hidden: the
         agent needs to see which card is in flight, and the browser's own drag
         image is what follows the cursor. */
      className={`relative cursor-grab active:cursor-grabbing ${dragging ? 'opacity-45' : ''}`}
    >
      <Card className="p-3 transition-colors duration-(--duration-base) ease-out hover:border-rule-2">
        <div className="flex items-start justify-between gap-2">
          <span className="rf-cardlink min-w-0">
            <Link
              to={to}
              viewTransition
              style={morph}
              className="text-sm font-medium leading-tight text-ink transition-colors duration-(--duration-fast) ease-out hover:text-brand-700"
            >
              {lead.contact?.name ?? '—'}
            </Link>
          </span>
          <ScoreDot score={lead.score} band={lead.score_band} />
        </div>

        <p className="mt-1 truncate text-xs text-muted">
          {lead.property_title ?? t('common.none')}
        </p>

        <div className="relative mt-2 flex items-center justify-between gap-2">
          <OriginTag origin={lead.origin} />
          <span
            className={`font-mono text-xs ${
              lead.is_sla_breached ? 'font-semibold text-error' : 'text-muted'
            }`}
          >
            {lead.sla_due_at !== null && !lead.is_sla_breached
              ? `${t('common.sla')} ${formatRelativeTime(lead.sla_due_at)}`
              : lead.last_activity_at !== null
                ? formatRelativeTime(lead.last_activity_at)
                : ''}
          </span>
        </div>

        {/* Touch only. Dragging stays the desktop gesture, and the stretched
            link over the card is switched off at the same breakpoint — with it
            still on, this button would never receive the tap. */}
        <button
          type="button"
          onClick={onMove}
          className="relative mt-2 flex min-h-(--control-h) w-full items-center justify-center gap-1.5 rounded-md border border-rule-2 text-sm font-medium text-ink-2 transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken active:translate-y-px lg:hidden"
        >
          <ArrowRightLeft aria-hidden="true" className="size-3.5" />
          {t('pipeline.move')}
        </button>
      </Card>
    </motion.div>
  )
}

/** Small local tag: the board has no room for the full origin badge row. */
function OriginTag({ origin }: { origin: CrmLead['origin'] }) {
  const { t } = useI18n()
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
        origin === 'price_drop' ? 'bg-warning-bg text-warning' : 'bg-surface-sunken text-ink-2'
      }`}
    >
      {t(`origin.${origin}`)}
    </span>
  )
}
