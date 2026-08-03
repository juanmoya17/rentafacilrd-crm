import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { Register, type Column } from '@/components/register'
import { useRecordMorph } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { UNIT_STATUSES, fetchInventory } from '@/lib/crm/projects'

// Columns come from the canonical status list, never from the data: a status
// nothing is in must keep its column instead of vanishing from the report,
// which is the same reason the server seeds every status at zero.
const STATUSES = UNIT_STATUSES

interface Row {
  id: number
  name: string
  city: string
  counts: number[]
  total: number
}

function ProjectName({ row }: { row: Row }) {
  const to = `/projects/${row.id}`
  const morph = useRecordMorph(to)

  return (
    <Link
      to={to}
      viewTransition
      style={morph}
      className="font-medium text-ink transition-colors duration-(--duration-fast) ease-out hover:text-brand-700"
    >
      {row.name}
    </Link>
  )
}

export function InventoryPage() {
  const { t } = useI18n()
  const inventory = useResource((signal) => fetchInventory(signal), [])

  if (inventory.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (inventory.status === 'error') {
    return (
      <ErrorState
        message={inventory.message}
        retryLabel={t('common.retry')}
        onRetry={inventory.reload}
      />
    )
  }

  // E.8 is an aggregation the server already did — the counts arrive per
  // project and pre-totalled, so nothing here re-derives them from unit rows.
  const rows: Row[] = inventory.data.projects.map((project) => ({
    id: project.id,
    name: project.title,
    city: project.city ?? '',
    counts: STATUSES.map((status) => project.by_status[status]),
    total: project.units_total,
  }))

  const totals = STATUSES.map((status) => inventory.data.totals[status])
  const grandTotal = inventory.data.totals.units_total

  const columns: Column<Row>[] = [
    {
      key: 'project',
      header: t('inventory.project'),
      card: 'primary',
      render: (row) => <ProjectName row={row} />,
    },
    { key: 'city', header: t('inventory.project'), card: 'meta', render: (row) => row.city },
    ...STATUSES.map(
      (status, index): Column<Row> => ({
        key: status,
        header: t(`unitStatus.${status}`),
        numeric: true,
        render: (row) => row.counts[index],
      }),
    ),
    {
      key: 'total',
      header: t('projects.units'),
      numeric: true,
      render: (row) => <span className="font-semibold text-ink">{row.total}</span>,
    },
  ]

  return (
    <>
      <PageHeader title={t('inventory.title')} subtitle={t('inventory.subtitle')} />

      {/* Empty when there are no PROJECTS, not when the unit count is zero: a
          project with no inventory loaded is exactly what an agent opens this
          screen to notice, and hiding the whole table behind a zero total
          would hide it. */}
      {rows.length === 0 ? (
        <EmptyState title={t('inventory.empty')} />
      ) : (
        // E.8 is an aggregation over `unidades`, not a new table.
        <Register
          label={t('inventory.title')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          footer={
            <tr>
              <th scope="row" className="px-3 py-2.5 text-left font-medium text-ink-2">
                {t('common.all')}
              </th>
              {/* The city column is `meta` on cards but still a real desktop
                  column, so the footer has to skip past it. */}
              <td />
              {totals.map((count, index) => (
                <td
                  key={STATUSES[index]}
                  className="px-3 py-2.5 text-right font-mono font-semibold text-ink"
                >
                  {count}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">
                {grandTotal}
              </td>
            </tr>
          }
        />
      )}
    </>
  )
}
