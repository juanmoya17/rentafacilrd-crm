import type { TranslationKey } from '@/lib/i18n/es'

/** The free listing allowance, as check-package-limit reports it for
 *  property_list. Omitted (not null) when a plan or the launch toggle governs. */
export interface FreeQuota {
  total: number
  used: number
  reserved: number
  remaining: number
}

export interface FreeQuotaBanner {
  tone: 'info' | 'warning'
  key: TranslationKey
  vars: Record<string, number>
}

/** What to tell the agent about their free allowance; null = say nothing. */
export function freeQuotaBanner(q?: FreeQuota | null): FreeQuotaBanner | null {
  if (!q) return null
  if (q.total === 0) return { tone: 'warning', key: 'freeQuota.verify', vars: {} }
  // `used` can exceed `total` in an edge case, so never show a negative.
  const remaining = Math.max(0, q.remaining)
  if (remaining === 0) return { tone: 'warning', key: 'freeQuota.used', vars: { total: q.total } }
  if (remaining === 1) return { tone: 'info', key: 'freeQuota.leftOne', vars: {} }
  return { tone: 'info', key: 'freeQuota.left', vars: { count: remaining } }
}
