import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { Register, type Column } from '@/components/register'
import { useRecordMorph } from '@/lib/motion'
import { PROJECTS, type UnitStatus } from '@/lib/mock/data'

const STATUSES: UnitStatus[] = ['available', 'reserved', 'sold', 'unavailable']

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

  const rows: Row[] = PROJECTS.map((project) => ({
    id: project.id,
    name: project.name,
    city: project.city,
    counts: STATUSES.map(
      (status) => project.units.filter((unit) => unit.status === status).length,
    ),
    total: project.units.length,
  }))

  const totals = STATUSES.map((status) =>
    PROJECTS.reduce(
      (sum, project) => sum + project.units.filter((unit) => unit.status === status).length,
      0,
    ),
  )
  const grandTotal = totals.reduce((sum, count) => sum + count, 0)

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
      <MockNotice>{t('mock.notice', { milestone: 'E.8' })}</MockNotice>

      {grandTotal === 0 ? (
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
