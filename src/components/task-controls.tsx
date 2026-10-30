import { useState, type FormEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useToast } from '@/lib/toast-context'
import { Button, Field } from '@/components/ui'
import { createTask, updateTask } from '@/lib/crm/api'
import { taskDraftProblem, toLocalInput } from '@/lib/crm/tasks'
import type { CrmTask } from '@/lib/crm/types'

const DATE_INPUT =
  'min-h-(--control-h) rounded-md border border-rule-2 bg-surface-raised px-3 py-1.5 text-sm text-ink'

/** Reschedule control for a pending task: commits on blur, only when the value changed and is a future date. */
export function TaskDueControl({
  task,
  onSaved,
}: {
  task: CrmTask
  onSaved: (task: CrmTask) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const original = toLocalInput(task.due_at)
  const [value, setValue] = useState(original)

  const commit = async () => {
    if (value === original) return
    if (taskDraftProblem({ title: task.title, due_at: value }, new Date()) !== null) {
      setValue(original)
      toast.fail(t('tasks.dateInvalid'))
      return
    }
    try {
      onSaved(await updateTask(task.id, { due_at: new Date(value).toISOString() }))
    } catch (caught: unknown) {
      setValue(original)
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    }
  }

  return (
    <input
      type="datetime-local"
      aria-label={t('tasks.reschedule')}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void commit()}
      className={DATE_INPUT}
    />
  )
}

/** "Nueva tarea" for a lead: title + date and time, validated before it is sent. */
export function NewTaskForm({ leadId, onCreated }: { leadId: number; onCreated: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [problem, setProblem] = useState<'title' | 'date' | null>(null)
  const [saving, setSaving] = useState(false)

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{t('leadDetail.addTask')}</Button>
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = taskDraftProblem({ title, due_at: dueAt }, new Date())
    setProblem(found)
    if (found !== null) return
    setSaving(true)
    try {
      await createTask({
        title: title.trim(),
        due_at: new Date(dueAt).toISOString(),
        lead_id: leadId,
      })
      setOpen(false)
      setTitle('')
      setDueAt('')
      onCreated()
    } catch (caught: unknown) {
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-2" noValidate>
      <Field
        id="new-task-title"
        label={t('tasks.fieldTitle')}
        value={title}
        onChange={setTitle}
        state={problem === 'title' ? 'error' : 'idle'}
        error={t('tasks.titleRequired')}
      />
      <div>
        <label htmlFor="new-task-due" className="block text-sm font-medium text-ink-2">
          {t('tasks.fieldDue')}
        </label>
        <input
          id="new-task-due"
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          aria-invalid={problem === 'date' || undefined}
          className={`${DATE_INPUT} mt-1 w-full ${problem === 'date' ? 'border-error' : ''}`}
        />
        {problem === 'date' && (
          <p role="alert" className="mt-1 text-xs text-error">
            {t('tasks.dateInvalid')}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" state={saving ? 'loading' : 'idle'}>
          {t('common.save')}
        </Button>
        <Button disabled={saving} onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
