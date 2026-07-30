import { Badge, type BadgeTone } from '@/components/ui'
import { useT } from '@/lib/i18n/context'
// Stage, Origin, Lifecycle, Operation and Moderation come from the wire
// contract — one definition, so a change in the API cannot silently disagree
// with the badge that renders it.
import type { Lifecycle, Moderation, Operation, Origin, Stage } from '@/lib/crm/types'
import type { UnitStatus } from '@/lib/mock/data'

/** One place decides which tone every domain value wears, so screens stay consistent. */

const LIFECYCLE_TONE: Record<Lifecycle, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  paused: 'warning',
  // Expiry is the only state paying fixes — it must not read as a failure.
  expired: 'warning',
  sold: 'brand',
  rented: 'brand',
  rejected: 'danger',
}

const STAGE_TONE: Record<Stage, BadgeTone> = {
  new: 'brand',
  contacted: 'neutral',
  visit: 'warning',
  negotiation: 'warning',
  won: 'success',
  lost: 'danger',
}

const UNIT_TONE: Record<UnitStatus, BadgeTone> = {
  available: 'success',
  reserved: 'warning',
  sold: 'brand',
  unavailable: 'neutral',
}

const MODERATION_TONE: Record<Moderation, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

export function OperationBadge({ operation }: { operation: Operation | null }) {
  const t = useT()
  // Null is "no operation" (a project row), not a sale. Render nothing — the
  // same discipline ScoreDot uses for an absent score band.
  if (operation === null) return null
  return <Badge tone={operation === 'sell' ? 'sell' : 'rent'}>{t(`operation.${operation}`)}</Badge>
}

export function LifecycleBadge({ lifecycle }: { lifecycle: Lifecycle }) {
  const t = useT()
  return <Badge tone={LIFECYCLE_TONE[lifecycle]}>{t(`lifecycle.${lifecycle}`)}</Badge>
}

export function ModerationBadge({ moderation }: { moderation: Moderation }) {
  const t = useT()
  return <Badge tone={MODERATION_TONE[moderation]}>{t(`moderation.${moderation}`)}</Badge>
}

export function StageBadge({ stage }: { stage: Stage }) {
  const t = useT()
  return <Badge tone={STAGE_TONE[stage]}>{t(`stage.${stage}`)}</Badge>
}

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  const t = useT()
  return <Badge tone={UNIT_TONE[status]}>{t(`unitStatus.${status}`)}</Badge>
}

export function OriginBadge({ origin }: { origin: Origin }) {
  const t = useT()
  // Price drop earns its own colour: it is the one source B.5 exists to prove out.
  return <Badge tone={origin === 'price_drop' ? 'warning' : 'neutral'}>{t(`origin.${origin}`)}</Badge>
}
