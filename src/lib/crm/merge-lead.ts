import type { CrmLead } from './types'

/**
 * Fold a fresh lead response over the one on screen. Old backends answered a
 * stage change without the timeline; dropping it would blank the detail view.
 */
export function mergeLead(prev: CrmLead, next: CrmLead): CrmLead {
  return {
    ...next,
    activities: next.activities ?? prev.activities,
    tasks: next.tasks ?? prev.tasks,
  }
}
