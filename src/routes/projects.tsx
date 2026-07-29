import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Card, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { PROJECTS } from '@/lib/mock/data'

export function ProjectsPage() {
  const { t, formatCurrency } = useI18n()

  if (PROJECTS.length === 0) {
    return (
      <>
        <PageHeader title={t('projects.title')} />
        <EmptyState title={t('projects.empty')} hint={t('projects.emptyHint')} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('projects.title')} subtitle={t('projects.subtitle')} />
      <MockNotice>{t('mock.notice', { milestone: 'E.1 – E.5' })}</MockNotice>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PROJECTS.map((project) => {
          const available = project.typologies.reduce((sum, typology) => sum + typology.unitsAvailable, 0)
          const total = project.typologies.reduce((sum, typology) => sum + typology.unitsTotal, 0)

          return (
            <Link key={project.id} to={`/projects/${project.id}`} className="block">
              <Card className="h-full p-4 transition-colors hover:border-brand-300">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">{project.name}</h2>
                  <Badge tone={project.status === 'sold_out' ? 'neutral' : 'brand'}>
                    {t(`projectStatus.${project.status}`)}
                  </Badge>
                </div>

                <p className="mt-0.5 text-xs text-slate-500">
                  {project.sector}, {project.city}
                </p>

                {/* E.5 — one card per project, never one per unit. */}
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {t('projects.priceFrom', { price: formatCurrency(project.priceFrom) })}
                </p>

                <dl className="mt-3 flex gap-4 text-xs text-slate-500">
                  <div>
                    <dt className="inline">{t('projects.typologies')}: </dt>
                    <dd className="inline tabular-nums font-medium text-slate-700">
                      {project.typologies.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">{t('projects.available')}: </dt>
                    <dd className="inline tabular-nums font-medium text-slate-700">
                      {available}/{total}
                    </dd>
                  </div>
                </dl>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
