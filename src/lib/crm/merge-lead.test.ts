import { describe, expect, it } from 'vitest'
import { mergeLead } from './merge-lead'
import type { CrmActivity, CrmLead, CrmTask } from './types'

const base = { id: 1, stage: 'new' } as CrmLead
const activities = [{ id: 7 }] as CrmActivity[]
const tasks = [{ id: 9 }] as CrmTask[]

describe('mergeLead', () => {
  it('keeps the previous tasks and activities when the response omits them', () => {
    const merged = mergeLead({ ...base, activities, tasks }, { ...base, stage: 'lost' })
    expect(merged.stage).toBe('lost')
    expect(merged.activities).toBe(activities)
    expect(merged.tasks).toBe(tasks)
  })

  it('takes the new ones when the response carries them, even empty', () => {
    const merged = mergeLead({ ...base, activities, tasks }, { ...base, activities: [], tasks: [] })
    expect(merged.activities).toEqual([])
    expect(merged.tasks).toEqual([])
  })
})
