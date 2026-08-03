import { Link } from 'react-router'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader } from '@/components/ui'
import { useLift, useRecordMorph, useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { fetchProjects, inventoryState, type CrmProject } from '@/lib/crm/projects'

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

function ProjectCard({ project, index }: { project: CrmProject; index: number }) {
  const { t, formatCurrency } = useI18n()
  const to = `/projects/${project.id}`
  const morph = useRecordMorph(to)
  const reveal = useRowReveal()
  const lift = useLift()

  // From the project, not summed from its typologies: units with no typology
  // are real inventory and would be missing from that sum.
  const available = project.units_available
  const total = project.units_total

  return (
    <motion.div {...reveal(index)} {...lift} className="h-full">
      <Link to={to} viewTransition className="block h-full">
        <div className="flex h-full flex-col rounded-lg border border-rule bg-surface-raised p-4 transition-colors duration-(--duration-base) ease-out hover:border-rule-2">
          <div className="flex items-start justify-between gap-2">
            <h2 style={morph} className="text-sm font-semibold text-ink">
              {project.title}
            </h2>
            {/* The stage, not a lifecycle. sold_out is derived and rides
                beside it — a project can be "Preventa" and sold out at once. */}
            <div className="flex shrink-0 gap-1">
              <Badge tone="brand">{t(`projectStage.${project.type}`)}</Badge>
              {project.sold_out ? <Badge tone="neutral">{t('projects.soldOut')}</Badge> : null}
            </div>
          </div>

          {project.city ? <p className="mt-0.5 text-xs text-muted">{project.city}</p> : null}

          {/* E.5 — one card per project, never one per unit. Null price_from
              renders nothing: "Desde RD$0" is a lie, not a placeholder. */}
          {project.price_from !== null ? (
            <p className="mt-3 font-mono text-sm font-semibold text-ink">
              {t('projects.priceFrom', { price: formatCurrency(Number(project.price_from)) })}
            </p>
          ) : null}

          <div className="mt-auto">
            {/* Zero units is inventory not loaded yet, NOT sold out — an empty
                bar there reads exactly like a sold-out one, so say it. */}
            {inventoryState(project) === 'empty' ? (
              <p className="mt-3 text-xs text-muted">{t('projects.noInventory')}</p>
            ) : (
              <>
                <AvailabilityBar available={available} total={total} />
                <dl className="mt-2 flex gap-4 text-xs text-muted">
                  <div>
                    <dt className="inline">{t('projects.available')}: </dt>
                    <dd className="inline font-mono font-medium text-ink-2">
                      {available}/{total}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export function ProjectsPage() {
  const { t } = useI18n()
  const projects = useResource((signal) => fetchProjects(signal), [])

  if (projects.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (projects.status === 'error') {
    return (
      <ErrorState message={projects.message} retryLabel={t('common.retry')} onRetry={projects.reload} />
    )
  }

  const newProject = (
    <LinkButton to="/projects/new" variant="primary">
      <Plus aria-hidden="true" className="size-4" />
      {t('newProject.new')}
    </LinkButton>
  )

  if (projects.data.length === 0) {
    return (
      <>
        <PageHeader title={t('projects.title')} />
        {/* The empty state names the next action, and here that action exists. */}
        <EmptyState title={t('projects.empty')} hint={t('projects.emptyHint')} action={newProject} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('projects.title')}
        subtitle={t('projects.subtitle')}
        actions={newProject}
      />

      {/* minmax(0,1fr), not 1fr: a bare 1fr track refuses to shrink below its
          content and pushes the grid past the viewport on mobile. */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
        {projects.data.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} />
        ))}
      </div>
    </>
  )
}
