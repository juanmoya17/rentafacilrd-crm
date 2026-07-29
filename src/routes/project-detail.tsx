import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, Card, EmptyState, MockNotice } from '@/components/ui'
import { RecordHeader } from '@/components/record'
import { Register, type Column } from '@/components/register'
import { UnitStatusBadge } from '@/components/labels'
import { useRowReveal } from '@/lib/motion'
import { PROJECTS, type Unit } from '@/lib/mock/data'

type Tab = 'models' | 'availability'
const TABS: Tab[] = ['models', 'availability']

export function ProjectDetailPage() {
  const { id } = useParams()
  const { t, formatCurrency, formatNumber } = useI18n()
  const [tab, setTab] = useState<Tab>('models')
  const reveal = useRowReveal()

  const project = PROJECTS.find((item) => String(item.id) === id)
  if (project === undefined) {
    return (
      <EmptyState
        title={t('error.notFound')}
        action={
          <Link to="/projects" viewTransition>
            <Button>{t('common.back')}</Button>
          </Link>
        }
      />
    )
  }

  const typologyName = (typologyId: number): string =>
    project.typologies.find((item) => item.id === typologyId)?.name ?? t('common.none')

  const unitColumns: Column<Unit>[] = [
    {
      key: 'identifier',
      header: t('projects.units'),
      card: 'primary',
      render: (unit) => <span className="font-mono">{unit.identifier}</span>,
    },
    {
      key: 'typology',
      header: t('projects.typologies'),
      card: 'meta',
      render: (unit) => typologyName(unit.typologyId),
    },
    {
      key: 'price',
      header: t('common.price'),
      numeric: true,
      render: (unit) => <span className="text-ink">{formatCurrency(unit.price)}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (unit) => <UnitStatusBadge status={unit.status} />,
    },
  ]

  return (
    <>
      <RecordHeader
        backTo="/projects"
        title={project.name}
        subtitle={`${project.sector}, ${project.city}`}
        badges={
          <>
            <Badge tone="brand">{t(`projectStatus.${project.status}`)}</Badge>
            <span className="font-mono text-sm font-semibold text-ink">
              {formatCurrency(project.priceFrom)} – {formatCurrency(project.priceTo)}
            </span>
          </>
        }
        actions={<Button variant="primary">{t('projectDetail.closeSale')}</Button>}
      />
      <MockNotice>{t('mock.notice', { milestone: 'E.1 – E.4 / E.7' })}</MockNotice>

      {/* The underline is one element that slides between tabs. A border
          appearing on the new tab and vanishing from the old communicates the
          same state but not the relationship between them. */}
      <div role="tablist" aria-label={t('projects.title')} className="mb-4 flex gap-1 border-b border-rule">
        {TABS.map((option) => {
          const selected = tab === option
          return (
            <button
              key={option}
              type="button"
              role="tab"
              id={`tab-${option}`}
              aria-selected={selected}
              aria-controls={`panel-${option}`}
              onClick={() => setTab(option)}
              className={`relative min-h-9 whitespace-nowrap px-3 py-2 text-sm transition-colors duration-(--duration-fast) ease-out ${
                selected ? 'font-medium text-brand-700' : 'text-muted hover:text-ink'
              }`}
            >
              {t(`projectDetail.${option}`)}
              {selected && (
                <motion.span
                  layoutId="project-tab"
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Crossfade, never a horizontal slide: sliding panels imply the tabs are
          a sequence, and these are two views of one project. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === 'models' ? (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
              {project.typologies.map((typology, index) => (
                <motion.div key={typology.id} {...reveal(index)}>
                  <Card className="flex h-full flex-col p-4">
                    <h3 className="text-sm font-semibold text-ink">{typology.name}</h3>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {typology.bedrooms}h · {typology.bathrooms}b ·{' '}
                      {formatNumber(typology.area)} m²
                    </p>
                    <p className="mt-3 font-mono text-sm font-semibold text-ink">
                      {t('projects.priceFrom', {
                        price: formatCurrency(typology.basePrice),
                      })}
                    </p>
                    <p className="mt-auto pt-2 text-xs text-muted">
                      {t('projectDetail.unitsOf', {
                        available: typology.unitsAvailable,
                        total: typology.unitsTotal,
                      })}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <>
              {/* E.4 — the public side only ever sees this aggregated by typology. */}
              <p className="mb-3 text-xs text-muted">{t('projectDetail.availabilityNote')}</p>

              {project.units.length === 0 ? (
                <EmptyState title={t('inventory.empty')} />
              ) : (
                <Register
                  label={t('projects.units')}
                  columns={unitColumns}
                  rows={project.units}
                  rowKey={(unit) => unit.id}
                  density="compact"
                />
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  )
}
