// domain/mutations.ts is applied twice per user action: optimistically by the Zustand
// store, then for real by LocalStorageAdapter (or mirrored by the server in API mode).
// If the two drift, the UI shows one task and persists another. Until now buildTask had
// no coverage of any kind and applyTaskPatch was reached only through the adapter
// contract suite. Everything here uses a fixed `now`: both production callers pass
// `new Date().toISOString()`, so the clock is an input, never something these functions
// read. Patches arrive already validated, so no invalid values are exercised here.

import { describe, expect, it } from 'vitest'
import type { Task } from '../domain/types'
import type { TaskPatchFields } from '../domain/mutations'
import { applyTaskPatch, buildTask, sortByPosition } from '../domain/mutations'

const NOW = '2026-09-07T10:00:00.000Z'
const LATER = '2026-09-07T11:30:00.000Z'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Buy milk',
    notes: null,
    priority: 'NONE',
    dueDate: null,
    completedAt: null,
    position: 1024,
    parentId: null,
    tagIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('buildTask', () => {
  it('fills every default for a title-only input', () => {
    const { id, ...rest } = buildTask({ title: 'Buy milk' }, [], NOW)

    expect(id).toMatch(UUID_V4)
    expect(rest).toEqual({
      title: 'Buy milk',
      notes: null,
      priority: 'NONE',
      dueDate: null,
      completedAt: null,
      position: 1024,
      parentId: null,
      tagIds: [],
      createdAt: NOW,
      updatedAt: NOW,
    })
  })

  it('mints a fresh UUIDv4 id on every call', () => {
    const a = buildTask({ title: 'a' }, [], NOW)
    const b = buildTask({ title: 'b' }, [], NOW)

    expect(a.id).toMatch(UUID_V4)
    expect(b.id).toMatch(UUID_V4)
    expect(a.id).not.toBe(b.id)
  })

  it('trims the title but passes notes through untouched', () => {
    const task = buildTask({ title: '  Buy milk  ', notes: '  keep my spaces  ' }, [], NOW)

    expect(task.title).toBe('Buy milk')
    expect(task.notes).toBe('  keep my spaces  ')
  })

  it('keeps explicit values instead of defaults', () => {
    const task = buildTask(
      { title: 'Ship', notes: 'v2', priority: 'HIGH', dueDate: '2026-09-30', tagIds: ['tag-work'] },
      [],
      NOW,
    )

    expect(task.notes).toBe('v2')
    expect(task.priority).toBe('HIGH')
    expect(task.dueDate).toBe('2026-09-30')
    expect(task.tagIds).toEqual(['tag-work'])
  })

  it('treats explicit null notes and dueDate the same as absent', () => {
    const task = buildTask({ title: 'Ship', notes: null, dueDate: null }, [], NOW)

    expect(task.notes).toBeNull()
    expect(task.dueDate).toBeNull()
  })

  it('appends 1024 past the highest existing position, whatever the order', () => {
    expect(buildTask({ title: 'x' }, [], NOW).position).toBe(1024)
    expect(buildTask({ title: 'x' }, [1024], NOW).position).toBe(2048)
    expect(buildTask({ title: 'x' }, [1024, 3072, 2048], NOW).position).toBe(4096)
    expect(buildTask({ title: 'x' }, [1536], NOW).position).toBe(2560)
  })

  it('stamps both timestamps from the supplied now, never the wall clock', () => {
    const task = buildTask({ title: 'x' }, [], NOW)

    expect(task.createdAt).toBe(NOW)
    expect(task.updatedAt).toBe(NOW)
  })

  it('does not mutate its inputs', () => {
    const input = { title: '  Ship  ', tagIds: ['tag-work'] }
    const positions = [3072, 1024]

    buildTask(input, positions, NOW)

    expect(input).toEqual({ title: '  Ship  ', tagIds: ['tag-work'] })
    expect(positions).toEqual([3072, 1024])
  })
})

describe('applyTaskPatch', () => {
  it('an empty patch changes only updatedAt and returns a new object', () => {
    const task = makeTask({ notes: 'keep', dueDate: '2026-09-10', completedAt: NOW })
    const next = applyTaskPatch(task, {}, LATER)

    expect(next).not.toBe(task)
    expect(next).toEqual({ ...task, updatedAt: LATER })
  })

  it('does not mutate the input task', () => {
    const task = makeTask({ notes: 'keep', tagIds: ['tag-work'] })
    const snapshot = structuredClone(task)

    applyTaskPatch(
      task,
      { title: 'New', notes: null, priority: 'HIGH', tagIds: ['tag-home'], completed: true },
      LATER,
    )

    expect(task).toEqual(snapshot)
  })

  it('never touches id, createdAt, or parentId', () => {
    const task = makeTask({ parentId: '22222222-2222-4222-8222-222222222222' })
    const next = applyTaskPatch(
      task,
      {
        title: 'New',
        notes: 'n',
        priority: 'LOW',
        dueDate: '2026-10-01',
        position: 2048,
        tagIds: ['tag-work'],
        completed: true,
      },
      LATER,
    )

    expect(next.id).toBe(task.id)
    expect(next.createdAt).toBe(NOW)
    expect(next.parentId).toBe('22222222-2222-4222-8222-222222222222')
  })

  describe('notes tri-state', () => {
    it('absent leaves notes unchanged', () => {
      expect(applyTaskPatch(makeTask({ notes: 'keep' }), {}, LATER).notes).toBe('keep')
    })

    it('null clears notes', () => {
      expect(applyTaskPatch(makeTask({ notes: 'keep' }), { notes: null }, LATER).notes).toBeNull()
    })

    it('a value replaces notes as-is, without trimming', () => {
      const next = applyTaskPatch(makeTask({ notes: 'old' }), { notes: '  new  ' }, LATER)
      expect(next.notes).toBe('  new  ')
    })
  })

  describe('dueDate tri-state', () => {
    it('absent leaves dueDate unchanged', () => {
      const next = applyTaskPatch(makeTask({ dueDate: '2026-09-10' }), {}, LATER)
      expect(next.dueDate).toBe('2026-09-10')
    })

    it('null clears dueDate', () => {
      const next = applyTaskPatch(makeTask({ dueDate: '2026-09-10' }), { dueDate: null }, LATER)
      expect(next.dueDate).toBeNull()
    })

    it('a value sets dueDate', () => {
      const next = applyTaskPatch(makeTask(), { dueDate: '2026-12-24' }, LATER)
      expect(next.dueDate).toBe('2026-12-24')
    })
  })

  it('trims a patched title', () => {
    const next = applyTaskPatch(makeTask(), { title: '  Buy oat milk  ' }, LATER)
    expect(next.title).toBe('Buy oat milk')
  })

  it('sets priority and position when present', () => {
    const next = applyTaskPatch(makeTask(), { priority: 'MEDIUM', position: 1536 }, LATER)

    expect(next.priority).toBe('MEDIUM')
    expect(next.position).toBe(1536)
  })

  it('copies tagIds instead of aliasing the patch array', () => {
    const patchTags = ['tag-work', 'tag-home']
    const next = applyTaskPatch(makeTask(), { tagIds: patchTags }, LATER)

    expect(next.tagIds).toEqual(['tag-work', 'tag-home'])
    expect(next.tagIds).not.toBe(patchTags)

    patchTags.push('tag-later')
    expect(next.tagIds).toEqual(['tag-work', 'tag-home'])
  })

  it('an empty tagIds array clears the tags', () => {
    const next = applyTaskPatch(makeTask({ tagIds: ['tag-work'] }), { tagIds: [] }, LATER)
    expect(next.tagIds).toEqual([])
  })

  describe('completed → completedAt', () => {
    it('true stamps completedAt with now', () => {
      const next = applyTaskPatch(makeTask(), { completed: true }, LATER)
      expect(next.completedAt).toBe(LATER)
    })

    it('false clears completedAt', () => {
      const next = applyTaskPatch(makeTask({ completedAt: NOW }), { completed: false }, LATER)
      expect(next.completedAt).toBeNull()
    })

    it('absent leaves an existing completedAt alone', () => {
      const next = applyTaskPatch(makeTask({ completedAt: NOW }), { title: 'Renamed' }, LATER)
      expect(next.completedAt).toBe(NOW)
    })

    it('true on an already-completed task re-stamps to now (SPEC: unconditional)', () => {
      const next = applyTaskPatch(makeTask({ completedAt: NOW }), { completed: true }, LATER)
      expect(next.completedAt).toBe(LATER)
    })
  })

  it('applies a full patch in one pass', () => {
    const patch: TaskPatchFields = {
      title: ' Everything ',
      notes: 'all fields',
      priority: 'HIGH',
      dueDate: '2026-11-11',
      position: 5120,
      tagIds: ['tag-home'],
      completed: true,
    }
    const next = applyTaskPatch(makeTask(), patch, LATER)

    expect(next).toEqual({
      ...makeTask(),
      title: 'Everything',
      notes: 'all fields',
      priority: 'HIGH',
      dueDate: '2026-11-11',
      position: 5120,
      tagIds: ['tag-home'],
      completedAt: LATER,
      updatedAt: LATER,
    })
  })
})

describe('sortByPosition', () => {
  const first = makeTask({ id: 'a', position: 1024 })
  const second = makeTask({ id: 'b', position: 1536 })
  const third = makeTask({ id: 'c', position: 4096 })

  it('orders ascending by position', () => {
    const sorted = sortByPosition([third, first, second])
    expect(sorted.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns a new array and leaves the input order untouched', () => {
    const input = [third, first, second]
    const sorted = sortByPosition(input)

    expect(sorted).not.toBe(input)
    expect(input.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('reorders the same Task objects rather than copying them', () => {
    const sorted = sortByPosition([second, first])

    expect(sorted[0]).toBe(first)
    expect(sorted[1]).toBe(second)
  })

  it('returns an empty array for an empty list', () => {
    expect(sortByPosition([])).toEqual([])
  })
})
