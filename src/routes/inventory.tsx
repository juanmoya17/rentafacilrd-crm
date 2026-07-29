import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Card, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { PROJECTS, type UnitStatus } from '@/lib/mock/data'

const STATUSES: UnitStatus[] = ['available', 'reserved', 'sold', 'unavailable']

export function InventoryPage() {
  const { t } = useI18n()

  const rows = PROJECTS.map((project) => ({
    project,
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

  return (
    <>
      <PageHeader title={t('inventory.title')} subtitle={t('inventory.subtitle')} />
      <MockNotice>{t('mock.notice', { milestone: 'E.8' })}</MockNotice>

      {grandTotal === 0 ? (
        <EmptyState title={t('inventory.empty')} />
      ) : (
        // E.8 is an aggregation over `unidades`, not a new table.
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t('inventory.project')}</th>
                {STATUSES.map((status) => (
                  <th key={status} scope="col" className="px-3 py-2 font-medium">
                    {t(`unitStatus.${status}`)}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium">{t('projects.units')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.project.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link
                      to={`/projects/${row.project.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {row.project.name}
                    </Link>
                    <p className="text-xs text-slate-500">{row.project.city}</p>
                  </td>
                  {row.counts.map((count, index) => (
                    <td key={STATUSES[index]} className="px-3 py-2 tabular-nums text-slate-700">
                      {count}
                    </td>
                  ))}
                  <td className="px-3 py-2 tabular-nums font-semibold text-slate-900">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-medium text-slate-700">
                  {t('common.all')}
                </th>
                {totals.map((count, index) => (
                  <td
                    key={STATUSES[index]}
                    className="px-3 py-2 tabular-nums font-semibold text-slate-900"
                  >
                    {count}
                  </td>
                ))}
                <td className="px-3 py-2 tabular-nums font-semibold text-slate-900">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </>
  )
}
