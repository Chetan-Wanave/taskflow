// store/selectors.ts is the single place the visible list is derived — TaskList,
// the keyboard roving focus and Alt+Arrow reorder all read it — so the search
// semantics (SPEC.md → Behaviour requirements → SRCH) are pinned here directly.
// Fixtures use fixed ISO timestamps, never the wall clock.

import { describe, expect, it } from 'vitest'
import type { Task } from '../domain/types'
import { selectVisibleTasks } from '../store/selectors'

const NOW = '2026-09-30T09:00:00.000Z'
const TAG = 'tag-travel'

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'title' | 'position'>): Task {
  return {
    notes: null,
    priority: 'NONE',
    dueDate: null,
    completedAt: null,
    parentId: null,
    tagIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// Scenario fixtures (SPEC.md SRCH acceptance scenarios 1–6).
const flights = task({
  id: 'flights',
  title: 'Book flights',
  notes: 'Use the Amex voucher',
  position: 1024,
  tagIds: [TAG],
})
const plants = task({ id: 'plants', title: 'Water plants', position: 2048 })
const refund = task({
  id: 'refund',
  title: 'Claim refund',
  notes: 'voucher already redeemed',
  position: 3072,
  completedAt: NOW,
})

type View = Parameters<typeof selectVisibleTasks>[0]

function view(overrides: Partial<View> = {}): View {
  return {
    tasks: [refund, plants, flights], // deliberately out of position order
    tags: [],
    filter: 'all',
    search: '',
    tagFilterId: null,
    ...overrides,
  }
}

const ids = (tasks: Task[]): string[] => tasks.map((t) => t.id)

describe('selectVisibleTasks — search (SRCH)', () => {
  it('SRCH-1: matches a query that appears only in notes', () => {
    expect(ids(selectVisibleTasks(view({ search: 'voucher' })))).toEqual(['flights', 'refund'])
  })

  it('SRCH-1: is case-insensitive for both title and notes', () => {
    expect(ids(selectVisibleTasks(view({ search: 'VOUCHER' })))).toEqual(['flights', 'refund'])
    expect(ids(selectVisibleTasks(view({ search: 'PLANTS' })))).toEqual(['plants'])
  })

  it('SRCH-1: trims the query and treats whitespace-only as no query', () => {
    expect(ids(selectVisibleTasks(view({ search: '   ' })))).toEqual(['flights', 'plants', 'refund'])
    expect(ids(selectVisibleTasks(view({ search: '  amex ' })))).toEqual(['flights'])
  })

  it('SRCH-3: a task with null notes matches on its title alone and never throws', () => {
    expect(() => selectVisibleTasks(view({ search: 'voucher' }))).not.toThrow()
    expect(ids(selectVisibleTasks(view({ search: 'voucher' })))).not.toContain('plants')
    expect(ids(selectVisibleTasks(view({ search: 'water' })))).toEqual(['plants'])
  })

  it('SRCH-2: ANDs the query with the status filter', () => {
    expect(ids(selectVisibleTasks(view({ search: 'voucher', filter: 'active' })))).toEqual(['flights'])
    expect(ids(selectVisibleTasks(view({ search: 'voucher', filter: 'completed' })))).toEqual(['refund'])
  })

  it('SRCH-2: ANDs the query with the tag filter', () => {
    expect(ids(selectVisibleTasks(view({ search: 'voucher', tagFilterId: TAG })))).toEqual(['flights'])
    expect(ids(selectVisibleTasks(view({ search: 'plants', tagFilterId: TAG })))).toEqual([])
  })

  it('returns matches in position order regardless of input order', () => {
    expect(ids(selectVisibleTasks(view()))).toEqual(['flights', 'plants', 'refund'])
  })
})
