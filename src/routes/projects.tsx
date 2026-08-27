import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRightLeft, Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader } from '@/components/ui'
import { useLift, useRecordMorph, useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { useAgencyRole } from '@/lib/crm/use-agency-role'
import {
  assignedAgentName,
  listMembers,
  reassignReceivers,
  type AgencyMember,
} from '@/lib/crm/agency'
import { ReassignDialog } from '@/components/reassign-dialog'
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

function ProjectCard({
  project,
  index,
  myId,
  isAdmin,
  members,
  onReassign,
}: {
  project: CrmProject
  index: number
  /** Who is looking. `undefined` while the auth context is still resolving. */
  myId: number | undefined
  isAdmin: boolean
  members: AgencyMember[]
  onReassign: (project: CrmProject) => void
}) {
  const { t, formatCurrency } = useI18n()
  const to = `/projects/${project.id}`
  const morph = useRecordMorph(to)
  const reveal = useRowReveal()
  const lift = useLift()

  // From the project, not summed from its typologies: units with no typology
  // are real inventory and would be missing from that sum.
  const available = project.units_available
  const total = project.units_total
  const assignedTo = assignedAgentName(project.added_by, project.added_by_name, myId)
  const canReassign = isAdmin && reassignReceivers(members, project.added_by).length > 0

  return (
    // `relative`, and the card body is no longer wrapped in a single <Link>:
    // the reassign button below needs to be a real <button>, and a <button>
    // inside an <a> is invalid HTML. Same `.rf-cardlink` overlay technique
    // PropertyCardGrid uses (index.css) — only the title sits in the actual
    // anchor, and its `::after` is stretched over this whole card, so the
    // full card stays clickable. The reassign button is a later sibling and
    // paints above that overlay automatically.
    <motion.div {...reveal(index)} {...lift} className="relative h-full">
      <div className="flex h-full flex-col rounded-lg border border-rule bg-surface-raised p-4 transition-colors duration-(--duration-base) ease-out hover:border-rule-2">
        <div className="flex items-start justify-between gap-2">
          <div className="rf-cardlink min-w-0 text-sm font-semibold text-ink [overflow-wrap:anywhere]">
            <Link to={to} viewTransition style={morph}>
              {project.title}
            </Link>
          </div>
          {/* The stage, not a lifecycle. sold_out is derived and rides
              beside it — a project can be "Preventa" and sold out at once. */}
          <div className="flex shrink-0 gap-1">
            <Badge tone="brand">{t(`projectStage.${project.type}`)}</Badge>
            {project.sold_out ? <Badge tone="neutral">{t('projects.soldOut')}</Badge> : null}
          </div>
        </div>

        {project.city ? <p className="mt-0.5 text-xs text-muted">{project.city}</p> : null}

        {/* Absent for a project that is mine, or whose colleague's name came
            back null — no reserved row for the common case of a solo agent's
            grid. The whole card is already the link, so this is just text. */}
        {assignedTo !== null && (
          <p className="mt-0.5 text-xs text-muted">
            {t('common.assignedTo', { name: assignedTo })}
          </p>
        )}

        {/* E.5 — one card per project, never one per unit. Null price_from
            renders nothing: "Desde RD$0" is a lie, not a placeholder. */}
        {project.price_from !== null ? (
          <p className="mt-3 font-mono text-sm font-semibold text-ink">
            {t('projects.priceFrom', { price: formatCurrency(Number(project.price_from)) })}
          </p>
        ) : null}

        <div className="relative mt-auto">
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

          {canReassign && (
            <div className="mt-2 flex justify-end">
              <Button onClick={() => onReassign(project)}>
                <ArrowRightLeft className="size-4" aria-hidden="true" />
                {t('reassign.trigger')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function ProjectsPage() {
  const { t } = useI18n()
  const projects = useResource((signal) => fetchProjects(signal), [])
  // Who is looking, for the "Asignada a" tag — undefined while the auth
  // context is still resolving, which assignedAgentName fails closed on.
  const { state: authState } = useAuth()
  const myId = authState.status === 'authenticated' ? authState.user.id : undefined

  // Task 6 — Reassign is admin-only and fails closed the same way
  // properties.tsx's does: `agency_role` isn't served yet, so `known` (and
  // `isAdmin` with it) is false for everyone today. Unlike properties.tsx,
  // nothing on this page fetched the roster before Task 6 — there is no
  // existing `listMembers()` call to reuse here.
  const { isAdmin } = useAgencyRole()
  const membersResource = useResource((signal) => listMembers({ limit: 100 }, signal), [])
  const members = membersResource.status === 'ready' ? membersResource.data.members : []
  // The project being reassigned, or `null` for no dialog open.
  const [reassigning, setReassigning] = useState<CrmProject | null>(null)

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
          <ProjectCard
            key={project.id}
            project={project}
            index={index}
            myId={myId}
            isAdmin={isAdmin}
            members={members}
            onReassign={setReassigning}
          />
        ))}
      </div>

      {reassigning !== null && (
        <ReassignDialog
          type="project"
          id={reassigning.id}
          listingTitle={reassigning.title}
          receivers={reassignReceivers(members, reassigning.added_by)}
          onClose={() => setReassigning(null)}
          onReassigned={() => projects.reload()}
        />
      )}
    </>
  )
}
