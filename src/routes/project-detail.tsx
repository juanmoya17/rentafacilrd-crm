import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Modal } from '@/components/ui'
import { RecordHeader } from '@/components/record'
import { Register, type Column } from '@/components/register'
import { UnitStatusBadge } from '@/components/labels'
import {
  TypologyDialog,
  UnitBatchDialog,
  UnitStatusDialog,
} from '@/components/project-dialogs'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { useToast } from '@/lib/toast-context'
import {
  deleteTypology,
  fetchProjectDetail,
  type CrmTypology,
  type CrmUnit,
} from '@/lib/crm/projects'

type Tab = 'models' | 'availability'
const TABS: Tab[] = ['models', 'availability']

type Dialog =
  | { kind: 'typology'; typology: CrmTypology | null }
  | { kind: 'delete'; typology: CrmTypology }
  | { kind: 'batch' }
  | { kind: 'unit'; unit: CrmUnit | null }

/** Outcome of the last write. Persistent, not a toast: "0 creadas · 12
 *  omitidas" is the one the agent has to actually read. */
interface Notice {
  text: string
  hint?: string
}

export function ProjectDetailPage() {
  const { id } = useParams()
  const projectId = Number(id)
  const { t, formatCurrency, formatNumber } = useI18n()
  const toast = useToast()
  const reveal = useRowReveal()
  const [tab, setTab] = useState<Tab>('models')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [deleting, setDeleting] = useState(false)

  // A non-numeric :id resolves to null rather than reaching the API — the
  // route pattern does not constrain it, so /projects/abc is reachable.
  const resource = useResource(
    (signal) =>
      Number.isInteger(projectId) ? fetchProjectDetail(projectId, signal) : Promise.resolve(null),
    [projectId],
  )
  const reload = resource.reload

  const removeTypology = async (typology: CrmTypology) => {
    setDeleting(true)
    try {
      const { units_declassified: count } = await deleteTypology(projectId, typology.id)
      setDialog(null)
      // The whole point of the endpoint returning this number: twelve units
      // survived their typology and the agent has to be told, because the
      // delete looked like it took them.
      setNotice({
        text:
          count === 0
            ? t('projectDetail.typologyDeletedNone')
            : t('projectDetail.typologyDeleted', { count }),
      })
      reload()
    } catch (caught: unknown) {
      toast.fail(
        caught instanceof Error ? caught.message : t('projectDetail.deleteTypologyFailed'),
        { label: t('common.retry'), run: () => void removeTypology(typology) },
      )
    } finally {
      setDeleting(false)
    }
  }

  if (resource.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (resource.status === 'error') {
    return (
      <ErrorState message={resource.message} retryLabel={t('common.retry')} onRetry={reload} />
    )
  }

  if (resource.data === null) {
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

  const { project, typologies, units, unitsTotal } = resource.data

  // Null renders as nothing: "Desde RD$0" is a lie, not a placeholder. Both
  // ends only appear as a range when they actually differ.
  const priceRange = (() => {
    const from = project.price_from
    const to = project.price_to
    if (from === null && to === null) return null
    if (from !== null && to !== null && from !== to) {
      return t('projectDetail.priceRange', {
        from: formatCurrency(Number(from)),
        to: formatCurrency(Number(to)),
      })
    }
    return t('projects.priceFrom', { price: formatCurrency(Number(from ?? to)) })
  })()

  const typologyTitle = (typologyId: number | null): string => {
    if (typologyId === null) return t('projectDetail.unclassified')

    return (
      typologies.find((item) => item.id === typologyId)?.title ?? t('projectDetail.unclassified')
    )
  }

  const unitColumns: Column<CrmUnit>[] = [
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
      render: (unit) => typologyTitle(unit.typology_id),
    },
    {
      // A string, never a number: "PB", "Mezzanine" and "PH" are real floors.
      key: 'floor',
      header: t('projectDetail.floor'),
      render: (unit) => unit.floor ?? '',
    },
    {
      key: 'price',
      header: t('common.price'),
      numeric: true,
      render: (unit) =>
        unit.price === null ? '' : <span className="text-ink">{formatCurrency(Number(unit.price))}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (unit) => <UnitStatusBadge status={unit.status} />,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (unit) => (
        <Button
          variant="ghost"
          aria-label={`${t('projectDetail.changeStatus')} — ${unit.identifier}`}
          onClick={() => setDialog({ kind: 'unit', unit })}
        >
          {t('projectDetail.changeStatus')}
        </Button>
      ),
    },
  ]

  return (
    <>
      <RecordHeader
        backTo="/projects"
        title={project.title}
        subtitle={project.city ?? undefined}
        meta={priceRange === null ? undefined : <p className="font-mono text-sm text-ink-2">{priceRange}</p>}
        // The stage, not a lifecycle — `status` on a project is a boolean
        // publish flag and `sold_out` is derived from inventory.
        badges={
          <>
            <Badge tone="brand">{t(`projectStage.${project.type}`)}</Badge>
            {project.sold_out && <Badge tone="neutral">{t('projects.soldOut')}</Badge>}
          </>
        }
        actions={
          <Button variant="primary" onClick={() => setDialog({ kind: 'unit', unit: null })}>
            {t('projectDetail.closeSale')}
          </Button>
        }
      />

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

      {notice && (
        <Card role="status" className="mb-3 px-3 py-2">
          <p className="font-mono text-sm text-ink-2">{notice.text}</p>
          {notice.hint !== undefined && <p className="mt-1 text-xs text-muted">{notice.hint}</p>}
        </Card>
      )}

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
            <>
              <div className="mb-3 flex justify-end">
                <Button onClick={() => setDialog({ kind: 'typology', typology: null })}>
                  {t('projectDetail.newTypology')}
                </Button>
              </div>

              {typologies.length === 0 ? (
                <EmptyState
                  title={t('projectDetail.noTypologies')}
                  hint={t('projectDetail.noTypologiesHint')}
                  action={
                    <Button
                      variant="primary"
                      onClick={() => setDialog({ kind: 'typology', typology: null })}
                    >
                      {t('projectDetail.newTypology')}
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
                  {typologies.map((typology, index) => {
                    // Every field is nullable. A typology with no area has
                    // missing data, not an area of zero — so the part is
                    // dropped rather than rendered as "0 m²".
                    const specs = [
                      typology.bedrooms === null ? null : `${typology.bedrooms}h`,
                      typology.bathrooms === null ? null : `${typology.bathrooms}b`,
                      typology.area === null
                        ? null
                        : `${formatNumber(Number(typology.area))} m²`,
                    ]
                      .filter((part): part is string => part !== null)
                      .join(' · ')

                    return (
                      <motion.div key={typology.id} {...reveal(index)}>
                        <Card className="flex h-full flex-col p-4">
                          <h3 className="text-sm font-semibold text-ink">{typology.title}</h3>
                          {specs !== '' && (
                            <p className="mt-1 font-mono text-xs text-muted">{specs}</p>
                          )}
                          {typology.base_price !== null && (
                            <p className="mt-3 font-mono text-sm font-semibold text-ink">
                              {t('projects.priceFrom', {
                                price: formatCurrency(Number(typology.base_price)),
                              })}
                            </p>
                          )}
                          {typology.units_total !== undefined && (
                            <p className="mt-auto pt-2 text-xs text-muted">
                              {t('projectDetail.unitsOf', {
                                available: typology.units_available ?? 0,
                                total: typology.units_total,
                              })}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              aria-label={`${t('common.edit')} — ${typology.title}`}
                              onClick={() => setDialog({ kind: 'typology', typology })}
                            >
                              {t('common.edit')}
                            </Button>
                            <Button
                              variant="ghost"
                              aria-label={`${t('common.delete')} — ${typology.title}`}
                              onClick={() => setDialog({ kind: 'delete', typology })}
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                {/* E.4 — the public side only ever sees this aggregated by typology. */}
                <p className="text-xs text-muted">{t('projectDetail.availabilityNote')}</p>
                <Button onClick={() => setDialog({ kind: 'batch' })}>
                  {t('projectDetail.generateUnits')}
                </Button>
              </div>

              {units.length === 0 ? (
                <EmptyState
                  title={t('projectDetail.noUnits')}
                  hint={t('projectDetail.noUnitsHint')}
                  action={
                    <Button variant="primary" onClick={() => setDialog({ kind: 'batch' })}>
                      {t('projectDetail.generateUnits')}
                    </Button>
                  }
                />
              ) : (
                <>
                  {/* No pager on this table. Saying what is missing beats a
                      table that looks complete at 200 of 250. */}
                  {unitsTotal > units.length && (
                    <p className="mb-2 text-xs text-muted">
                      {t('projectDetail.unitsShown', { shown: units.length, total: unitsTotal })}
                    </p>
                  )}
                  <Register
                    label={t('projects.units')}
                    columns={unitColumns}
                    rows={units}
                    rowKey={(unit) => unit.id}
                    density="compact"
                  />
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {dialog?.kind === 'typology' && (
        <TypologyDialog
          projectId={project.id}
          typology={dialog.typology}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            setNotice(null)
            // A typology write moves the project's price range through
            // ProjectPlansObserver — the header is stale until this lands.
            reload()
          }}
        />
      )}

      {dialog?.kind === 'delete' && (
        <Modal
          title={t('projectDetail.deleteTypologyTitle', { title: dialog.typology.title })}
          closeLabel={t('common.close')}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button disabled={deleting} onClick={() => setDialog(null)}>
                {t('bulk.cancel')}
              </Button>
              <Button
                variant="primary"
                state={deleting ? 'loading' : 'idle'}
                onClick={() => void removeTypology(dialog.typology)}
              >
                {t('bulk.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">{t('projectDetail.deleteTypologyBody')}</p>
        </Modal>
      )}

      {dialog?.kind === 'batch' && (
        <UnitBatchDialog
          projectId={project.id}
          typologies={typologies}
          onClose={() => setDialog(null)}
          onCreated={(result) => {
            setDialog(null)
            // Both numbers, always. "0 creadas · 12 omitidas" is what a double
            // submit looks like, and a generic success toast would hide it.
            setNotice({
              text: t('units.batchResult', result),
              hint: result.skipped > 0 ? t('units.batchSkippedNote') : undefined,
            })
            setTab('availability')
            reload()
          }}
        />
      )}

      {dialog?.kind === 'unit' && (
        <UnitStatusDialog
          projectId={project.id}
          units={units}
          unit={dialog.unit}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            setNotice(null)
            reload()
          }}
        />
      )}
    </>
  )
}
