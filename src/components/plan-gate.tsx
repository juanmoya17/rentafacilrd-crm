import type { ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { EmptyState, ErrorState, LinkButton, LoadingState } from '@/components/ui'
import { useResource } from '@/lib/use-resource'
import { gateReason, type GatedFeature } from '@/lib/crm/packages'
import { checkPackageLimit } from '@/lib/crm/reference'

/**
 * Refuse before the form, not after it.
 *
 * The Flutter app already does this at main_activity.dart — it checks
 * check-package-limit before opening the add flow. Without it the CRM lets an
 * agent fill nine fields and upload a cover before the server refuses, which is
 * the complaint that started this work. The submit-time error stays as the
 * backstop for a plan that expires mid-form.
 */
export function PlanGate({
  feature,
  children,
}: {
  feature: GatedFeature
  children: ReactNode
}) {
  const { t } = useI18n()
  // reference.ts owns the fetch; gateReason owns the decision — and the
  // fail-closed guard, since that fetch returns `body.data` unguarded.
  const gate = useResource(
    (signal) => checkPackageLimit(feature, signal).then(gateReason),
    [feature],
  )

  if (gate.status === 'loading') return <LoadingState label={t('gate.checking')} />
  if (gate.status === 'error') {
    return <ErrorState message={gate.message} retryLabel={t('plan.retry')} onRetry={gate.reload} />
  }
  if (gate.data === 'ok') return <>{children}</>

  const noPackage = gate.data === 'no-package'
  return (
    <EmptyState
      title={t(noPackage ? 'gate.noPackage' : 'gate.limitReached')}
      hint={t(noPackage ? 'gate.noPackageHint' : 'gate.limitReachedHint')}
      action={<LinkButton to="/plan">{t('gate.seePlans')}</LinkButton>}
    />
  )
}
