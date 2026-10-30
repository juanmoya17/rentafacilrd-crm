/** Pure rules for the task form — kept out of the components so vitest can reach them. */

export type TaskDraftProblem = 'title' | 'date' | null

/** Blank title, or a date that is missing, unparseable or already past. */
export function taskDraftProblem(
  draft: { title: string; due_at: string },
  now: Date,
): TaskDraftProblem {
  if (draft.title.trim() === '') return 'title'
  const due = new Date(draft.due_at)
  if (draft.due_at === '' || Number.isNaN(due.getTime()) || due.getTime() <= now.getTime()) {
    return 'date'
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO instant -> the `YYYY-MM-DDTHH:mm` (local time) a datetime-local input takes. '' when absent/invalid. */
export function toLocalInput(iso: string | null): string {
  if (iso === null) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
