import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui'
import { classifyBatchError, messageFor, runBatch } from '@/lib/crm/properties'
import { BULK_ACTIONS, MAX_BATCH, type BulkAction } from '@/lib/crm/types'

/**
 * A.4 — the real bulk bar. Five actions, all-or-nothing on the server: a
 * refusal changes nothing, so every failure message says so and stays inline
 * (see `messageFor` in lib/crm/properties.ts) rather than in a toast that
 * could dismiss itself while the agent is still reading the numbers.
 *
 * `delete` is the one destructive action (spec decision: `close` is
 * irreversible in practice too, but only `delete` is destructive) and is the
 * only one gated behind a confirmation step.
 */
export function BulkBar({
  ids,
  balance,
  onDone,
  onStale,
}: {
  ids: number[]
  /** Null when the summary fetch that carries it failed or hasn't landed yet
   *  — only `feature` needs it, so the other four actions stay usable. */
  balance: { total: number; unlimited: boolean } | null
  onDone: (affected: number) => void
  onStale: () => void
}) {
  const { t, formatNumber } = useI18n()
  const [busy, setBusy] = useState<BulkAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const apply = async (action: BulkAction) => {
    setBusy(action)
    setError(null)
    try {
      const affected = await runBatch(action, ids.slice(0, MAX_BATCH))
      onDone(affected)
    } catch (caught: unknown) {
      const failure = classifyBatchError(caught)
      setError(messageFor(failure, t))
      if (failure.kind === 'stale') onStale()
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  return (
    // Plain div with literal classes, not `Card`: `Card` appends its own
    // `className` after `rounded-lg border border-rule bg-surface-raised`
    // with no tailwind-merge, so on equal specificity the brand tint here
    // silently lost to Card's defaults in the compiled CSS. Same wrapper
    // classes the pre-Task-6 placeholder bar used.
    <div className="mb-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium text-brand-800">
          {t('common.selectedCount', { count: ids.length })}
        </span>
        {/* Decision #4: the balance is visible before featuring spends anything. */}
        <span className="text-xs text-brand-700">
          {balance === null
            ? t('bulk.balanceUnavailable')
            : balance.unlimited
              ? t('bulk.balanceUnlimited')
              : t('bulk.balance', { count: formatNumber(balance.total) })}
        </span>

        <div className="ml-auto flex flex-wrap gap-1.5">
          {BULK_ACTIONS.filter((action) => action !== 'delete').map((action) => (
            <Button
              key={action}
              disabled={busy !== null || (action === 'feature' && balance === null)}
              onClick={() => void apply(action)}
            >
              {busy === action ? t('bulk.applying') : t(`properties.bulk.${action}`)}
            </Button>
          ))}
          {/* Destructive: this button only opens the confirmation below. */}
          <Button
            disabled={busy !== null}
            onClick={() => setConfirming(true)}
            className="!border-error !text-error hover:!bg-error-bg"
          >
            {t('properties.bulk.delete')}
          </Button>
        </div>
      </div>

      {error !== null && (
        <p role="alert" className="mt-2 rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {confirming && (
        <div className="mt-2 rounded-md border border-error bg-surface-raised px-3 py-2">
          <p className="text-sm font-medium text-ink">
            {t('bulk.confirmDeleteTitle', { count: ids.length })}
          </p>
          <p className="mt-1 text-sm text-ink-2">{t('bulk.confirmDeleteBody')}</p>
          <div className="mt-2 flex gap-1.5">
            <Button
              variant="primary"
              disabled={busy !== null}
              onClick={() => void apply('delete')}
              className="!bg-error hover:!bg-error"
            >
              {busy === 'delete' ? t('bulk.applying') : t('bulk.confirm')}
            </Button>
            <Button disabled={busy !== null} onClick={() => setConfirming(false)}>
              {t('bulk.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
