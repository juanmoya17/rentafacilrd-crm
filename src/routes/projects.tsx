import { Link } from 'react-router'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { useLift, useRecordMorph, useRowReveal } from '@/lib/motion'
import { PROJECTS, type Project } from '@/lib/mock/data'

/** Share of units still available — the one number this card exists to show. */
function AvailabilityBar({ available, total }: { available: number; total: number }) {
  const share = total === 0 ? 0 : Math.round((available / total) * 100)
  return (
    <div className="mt-3">
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-rule"
        role="img"
        aria-label={`${available}/${total}`}
      >
        {/* transform, not width — animating width reflows every frame. */}
        <motion.div
          className="h-full origin-left rounded-full bg-accent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: share / 100 }}
          viewport={{ once: true }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const { t, formatCurrency } = useI18n()
  const to = `/projects/${project.id}`
  const morph = useRecordMorph(to)
  const reveal = useRowReveal()
  const lift = useLift()

  const available = project.typologies.reduce((sum, typology) => sum + typology.unitsAvailable, 0)
  const total = project.typologies.reduce((sum, typology) => sum + typology.unitsTotal, 0)

  return (
    <motion.div {...reveal(index)} {...lift} className="h-full">
      <Link to={to} viewTransition className="block h-full">
        <div className="flex h-full flex-col rounded-lg border border-rule bg-surface-raised p-4 transition-colors duration-(--duration-base) ease-out hover:border-rule-2">
          <div className="flex items-start justify-between gap-2">
            <h2 style={morph} className="text-sm font-semibold text-ink">
              {project.name}
            </h2>
            <Badge tone={project.status === 'sold_out' ? 'neutral' : 'brand'}>
              {t(`projectStatus.${project.status}`)}
            </Badge>
          </div>

          <p className="mt-0.5 text-xs text-muted">
            {project.sector}, {project.city}
          </p>

          {/* E.5 — one card per project, never one per unit. */}
          <p className="mt-3 font-mono text-sm font-semibold text-ink">
            {t('projects.priceFrom', { price: formatCurrency(project.priceFrom) })}
          </p>

          <div className="mt-auto">
            <AvailabilityBar available={available} total={total} />
            <dl className="mt-2 flex gap-4 text-xs text-muted">
              <div>
                <dt className="inline">{t('projects.typologies')}: </dt>
                <dd className="inline font-mono font-medium text-ink-2">
                  {project.typologies.length}
                </dd>
              </div>
              <div>
                <dt className="inline">{t('projects.available')}: </dt>
                <dd className="inline font-mono font-medium text-ink-2">
                  {available}/{total}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export function ProjectsPage() {
  const { t } = useI18n()

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

      {/* minmax(0,1fr), not 1fr: a bare 1fr track refuses to shrink below its
          content and pushes the grid past the viewport on mobile. */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
        {PROJECTS.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} />
        ))}
      </div>
    </>
  )
}
