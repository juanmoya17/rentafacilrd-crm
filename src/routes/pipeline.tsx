import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Card, MockNotice, PageHeader, ScoreDot } from '@/components/ui'
import { OperationBadge } from '@/components/labels'
import { LEADS, isSlaBreached, scoreBand, type Stage } from '@/lib/mock/data'

const STAGES: Stage[] = ['new', 'contacted', 'visit', 'negotiation', 'won', 'lost']

export function PipelinePage() {
  const { t, formatRelativeTime } = useI18n()

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
      <MockNotice>{t('mock.notice', { milestone: 'C.3' })}</MockNotice>

      {/* The board scrolls sideways inside this box; the page never does. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
        <div className="flex min-w-max gap-3">
          {STAGES.map((stage) => {
            const leads = LEADS.filter((lead) => lead.stage === stage)
            return (
              <section key={stage} className="w-64 shrink-0" aria-label={t(`stage.${stage}`)}>
                <header className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-slate-700">{t(`stage.${stage}`)}</h2>
                  <span className="text-xs font-medium tabular-nums text-slate-400">
                    {leads.length}
                  </span>
                </header>

                <div className="space-y-2">
                  {leads.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                      {t('pipeline.emptyColumn')}
                    </p>
                  )}

                  {leads.map((lead) => {
                    const breached = isSlaBreached(lead)
                    return (
                      <Link key={lead.id} to={`/leads/${lead.id}`} className="block">
                        <Card className="p-3 transition-colors hover:border-brand-300">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight text-slate-900">
                              {lead.name}
                            </p>
                            <ScoreDot score={lead.score} band={scoreBand(lead.score)} />
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {lead.propertyCode} · {lead.propertyTitle}
                          </p>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <OperationBadge operation={lead.operation} />
                            <span
                              className={`text-xs tabular-nums ${
                                breached ? 'font-semibold text-red-600' : 'text-slate-400'
                              }`}
                            >
                              {lead.slaDueAt === null
                                ? formatRelativeTime(lead.lastActivityAt)
                                : `${t('common.sla')} ${formatRelativeTime(lead.slaDueAt)}`}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
