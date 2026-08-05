import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { RecordSectionHead } from '@/components/record'
import { CheckoutDialog } from '@/components/checkout-dialog'
import { useResource } from '@/lib/use-resource'
import { getPackages, getPendingBankTransfer, type Package, type PackageFeature } from '@/lib/crm/packages'

/**
 * Plan and billing.
 *
 * The usage rows are the reason this is not just a pricing page: an agent who
 * cannot publish needs to see WHICH quota is spent, and get-package already
 * carries used/total per feature on the packages they hold.
 */
export function PlanPage() {
  const { t, formatCurrency, formatDate } = useI18n()
  const catalog = useResource((signal) => getPackages(signal), [])
  const pending = useResource((signal) => getPendingBankTransfer(signal), [])
  const [selected, setSelected] = useState<Package | null>(null)

  // Stripe's 3DS challenge sends the whole browser to return_url and back
  // with `redirect_status` on the query string — the page boots fresh, so no
  // dialog and no component state survives that round trip. This is the only
  // way an agent who just cleared a challenge learns what happened.
  const [params] = useSearchParams()
  const redirectStatus = params.get('redirect_status')

  if (catalog.status === 'loading') return <LoadingState label={t('plan.loading')} />
  if (catalog.status === 'error') {
    return (
      <ErrorState
        message={catalog.message}
        retryLabel={t('plan.retry')}
        onRetry={catalog.reload}
      />
    )
  }

  const { active, available } = catalog.data

  const usage = (feature: PackageFeature): string => {
    if (feature.limit_type === 'unlimited') return t('plan.unlimited')
    return t('plan.usage', {
      used: feature.used_limit ?? 0,
      total: feature.total_limit ?? feature.limit ?? 0,
    })
  }

  return (
    <>
      <PageHeader title={t('plan.title')} subtitle={t('plan.subtitle')} />

      {/* 'succeeded' only promises the charge went through, not that the plan
          is live — the server grants it on Stripe's webhook, which can lag
          this redirect. Anything else means the challenge did not clear. */}
      {redirectStatus !== null && (
        <Card className="mt-4 p-4" role="status">
          <p className="text-sm font-medium text-ink">
            {t(redirectStatus === 'succeeded' ? 'plan.returnSucceeded' : 'plan.returnFailed')}
          </p>
        </Card>
      )}

      {pending.status === 'ready' && pending.data !== null && (
        <Card className="mt-4 p-4" role="status">
          <p className="text-sm font-medium text-ink">
            {t('plan.pendingTransfer', { package: pending.data.packageName })}
          </p>
          <p className="mt-1 text-sm text-ink-2">{t('plan.pendingTransferHint')}</p>
        </Card>
      )}

      <div className="mt-6 grid gap-6">
        <section>
          <RecordSectionHead label={t('plan.current')} />
          {active.length === 0 ? (
            <EmptyState title={t('plan.none')} hint={t('plan.noneHint')} />
          ) : (
            <div className="grid gap-3">
              {active.map((pkg) => (
                <Card key={pkg.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">
                      {pkg.translated_name ?? pkg.name}
                    </h3>
                    {pkg.end_date != null && pkg.end_date !== '' && (
                      <Badge tone="neutral">{t('plan.until', { date: formatDate(pkg.end_date) })}</Badge>
                    )}
                  </div>
                  <ul className="mt-3 grid gap-1.5">
                    {pkg.features.map((feature) => (
                      <li key={feature.id} className="flex justify-between gap-3 text-sm">
                        <span className="text-ink-2">{feature.translated_name ?? feature.name}</span>
                        <span className="font-mono text-xs text-muted">{usage(feature)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <RecordSectionHead label={t('plan.available')} />
          {available.length === 0 ? (
            <EmptyState title={t('plan.empty')} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {available.map((pkg) => (
                <Card key={pkg.id} className="flex flex-col gap-3 p-4">
                  <h3 className="text-sm font-semibold text-ink">
                    {pkg.translated_name ?? pkg.name}
                  </h3>
                  <p className="text-lg font-semibold text-ink">
                    {formatCurrency(pkg.effective_price)}
                  </p>
                  <ul className="grid gap-1 text-sm text-ink-2">
                    {pkg.features.map((feature) => (
                      <li key={feature.id}>{feature.translated_name ?? feature.name}</li>
                    ))}
                  </ul>
                  <Button variant="primary" onClick={() => setSelected(pkg)} className="mt-auto">
                    {t('plan.buy')}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected !== null && (
        <CheckoutDialog
          pkg={selected}
          onClose={() => {
            setSelected(null)
            pending.reload()
          }}
          onPurchased={() => {
            setSelected(null)
            catalog.reload()
            pending.reload()
          }}
        />
      )}
    </>
  )
}
