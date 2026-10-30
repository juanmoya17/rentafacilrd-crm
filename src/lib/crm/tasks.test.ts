import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({ api }))

import { createTask, updateTask } from './api'
import { taskDraftProblem, toLocalInput } from './tasks'

const now = new Date('2026-11-01T12:00:00Z')

describe('taskDraftProblem', () => {
  it('accepts a titled task due in the future', () => {
    expect(taskDraftProblem({ title: 'Llamar', due_at: '2026-11-02T09:00:00Z' }, now)).toBeNull()
  })
  it('rejects a blank or whitespace title', () => {
    expect(taskDraftProblem({ title: '  ', due_at: '2026-11-02T09:00:00Z' }, now)).toBe('title')
  })
  it('rejects an empty, invalid or past date', () => {
    expect(taskDraftProblem({ title: 'x', due_at: '' }, now)).toBe('date')
    expect(taskDraftProblem({ title: 'x', due_at: 'nope' }, now)).toBe('date')
    expect(taskDraftProblem({ title: 'x', due_at: '2026-10-31T09:00:00Z' }, now)).toBe('date')
  })
  it('reports the title first when both are wrong', () => {
    expect(taskDraftProblem({ title: '', due_at: '' }, now)).toBe('title')
  })
})

describe('toLocalInput', () => {
  it('round-trips through the local clock', () => {
    const local = toLocalInput('2026-11-02T09:30:00Z')
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(new Date(local).toISOString()).toBe('2026-11-02T09:30:00.000Z')
  })
  it('is empty for null or garbage', () => {
    expect(toLocalInput(null)).toBe('')
    expect(toLocalInput('nope')).toBe('')
  })
})

describe('createTask / updateTask', () => {
  beforeEach(() => api.mockReset())

  it('POSTs the draft to crm/tasks and unwraps the resource', async () => {
    api.mockResolvedValue({ data: { id: 4 } })
    const input = { title: 'Llamar', due_at: '2026-11-02T09:00:00Z', lead_id: 7 }
    await expect(createTask(input)).resolves.toEqual({ id: 4 })
    expect(api).toHaveBeenCalledWith('crm/tasks', { method: 'POST', body: input })
  })

  it('PATCHes only the due date to crm/tasks/{id}', async () => {
    api.mockResolvedValue({ data: { id: 4 } })
    await updateTask(4, { due_at: '2026-11-03T09:00:00Z' })
    expect(api).toHaveBeenCalledWith('crm/tasks/4', {
      method: 'PATCH',
      body: { due_at: '2026-11-03T09:00:00Z' },
    })
  })
})
