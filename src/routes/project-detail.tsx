import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, Card, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { UnitStatusBadge } from '@/components/labels'
import { PROJECTS } from '@/lib/mock/data'

type Tab = 'models' | 'availability'

export function ProjectDetailPage() {
  const { id } = useParams()
  const { t, formatCurrency, formatNumber } = useI18n()
  const [tab, setTab] = useState<Tab>('models')

  const project = PROJECTS.find((item) => String(item.id) === id)
  if (project === undefined) {
    return (
      <EmptyState
        title={t('error.notFound')}
        action={<Link to="/projects"><Button>{t('common.back')}</Button></Link>}
      />
    )
  }

  const tabs: Tab[] = ['models', 'availability']

  return (
    <>
      <Link to="/projects" className="mb-3 inline-block text-sm text-brand-700 hover:underline">
        ← {t('common.back')}
      </Link>

      <PageHeader
        title={project.name}
        subtitle={`${project.sector}, ${project.city}`}
        actions={<Button variant="primary">{t('projectDetail.closeSale')}</Button>}
      />
      <MockNotice>{t('mock.notice', { milestone: 'E.1 – E.4 / E.7' })}</MockNotice>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="brand">{t(`projectStatus.${project.status}`)}</Badge>
        <span className="text-sm font-semibold text-slate-900">
          {formatCurrency(project.priceFrom)} – {formatCurrency(project.priceTo)}
        </span>
      </div>

      <div role="tablist" className="mb-3 flex gap-1 border-b border-slate-200">
        {tabs.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === option
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t(`projectDetail.${option}`)}
          </button>
        ))}
      </div>

      {tab === 'models' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {project.typologies.map((typology) => (
            <Card key={typology.id} className="p-4">
              <h3 className="text-sm font-semibold text-slate-900">{typology.name}</h3>
              <p className="mt-1 text-xs tabular-nums text-slate-500">
                {typology.bedrooms}h · {typology.bathrooms}b · {formatNumber(typology.area)} m²
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {t('projects.priceFrom', { price: formatCurrency(typology.basePrice) })}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {t('projectDetail.unitsOf', {
                  available: typology.unitsAvailable,
                  total: typology.unitsTotal,
                })}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* E.4 — the public side only ever sees this aggregated by typology. */}
          <p className="mb-3 text-xs text-slate-500">{t('projectDetail.availabilityNote')}</p>

          {project.units.length === 0 ? (
            <EmptyState title={t('inventory.empty')} />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">{t('projects.units')}</th>
                    <th scope="col" className="px-3 py-2 font-medium">{t('projects.typologies')}</th>
                    <th scope="col" className="px-3 py-2 font-medium">{t('common.price')}</th>
                    <th scope="col" className="px-3 py-2 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{unit.identifier}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {project.typologies.find((item) => item.id === unit.typologyId)?.name ??
                          t('common.none')}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-800">
                        {formatCurrency(unit.price)}
                      </td>
                      <td className="px-3 py-2">
                        <UnitStatusBadge status={unit.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </>
  )
}
