// Shared contract suite run against BOTH adapters: LocalStorageAdapter
// directly, ApiAdapter over MSW. This is what keeps the dormant adapter honest.

import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Priority, Tag, Task } from '../domain/types'
import { ApiAdapter } from '../storage/ApiAdapter'
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter'
import { RepositoryError } from '../storage/StorageAdapter'
import type { StorageAdapter } from '../storage/StorageAdapter'
import { API_BASE, handlers, resetDb } from './mockApi'

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: 'Ship design tokens',
    notes: null,
    priority: 'NONE',
    dueDate: null,
    completedAt: null,
    position: 1024,
    parentId: null,
    tagIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: crypto.randomUUID(),
    name: 'work',
    color: '#5B5BD6',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

async function expectRepositoryError(
  promise: Promise<unknown>,
  kind: RepositoryError['kind'],
): Promise<RepositoryError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).kind).toBe(kind)
    return error as RepositoryError
  }
  throw new Error(`expected a RepositoryError of kind '${kind}' but the call succeeded`)
}

function adapterContractSuite(name: string, freshAdapter: () => Promise<StorageAdapter>) {
  describe(`StorageAdapter contract — ${name}`, () => {
    let adapter: StorageAdapter

    beforeEach(async () => {
      adapter = await freshAdapter()
    })

    it('load() returns an empty schemaVersion-2 envelope initially', async () => {
      const data = await adapter.load()
      expect(data).toEqual({ schemaVersion: 2, tasks: [], tags: [] })
    })

    it('createTask persists the client-supplied row (id, position, fields), trimming the title', async () => {
      const task = makeTask({ title: '  First  ', priority: 'HIGH', dueDate: '2026-09-08' })
      const saved = await adapter.createTask(task)
      expect(saved.id).toBe(task.id)
      expect(saved.title).toBe('First')
      expect(saved.priority).toBe('HIGH')
      expect(saved.dueDate).toBe('2026-09-08')
      expect(saved.position).toBe(1024)
      expect(saved.completedAt).toBeNull()
      expect(saved.parentId).toBeNull()

      const data = await adapter.load()
      expect(data.tasks.map((t) => t.id)).toEqual([task.id])
    })

    it('createTask rejects a duplicate id with a conflict error', async () => {
      const task = makeTask()
      await adapter.createTask(task)
      await expectRepositoryError(adapter.createTask({ ...task }), 'conflict')
    })

    it('createTask rejects a blank title with a validation error', async () => {
      const error = await expectRepositoryError(
        adapter.createTask(makeTask({ title: '   ' })),
        'validation',
      )
      expect(error.fieldErrors?.some((e) => e.field === 'title')).toBe(true)
    })

    it('createTask rejects unknown tag ids', async () => {
      await expectRepositoryError(
        adapter.createTask(makeTask({ tagIds: [crypto.randomUUID()] })),
        'validation',
      )
    })

    it('updateTask patches a subset of fields and returns the task', async () => {
      const task = makeTask()
      await adapter.createTask(task)
      const updated = await adapter.updateTask(task.id, {
        title: 'Renamed',
        notes: 'Some notes',
        priority: 'MEDIUM' as Priority,
        dueDate: '2026-12-31',
      })
      expect(updated.title).toBe('Renamed')
      expect(updated.notes).toBe('Some notes')
      expect(updated.priority).toBe('MEDIUM')
      expect(updated.dueDate).toBe('2026-12-31')
      expect(updated.position).toBe(task.position) // untouched fields unchanged
    })

    it('completed:true stamps completedAt on the executing side; false clears it', async () => {
      const task = makeTask()
      await adapter.createTask(task)
      const done = await adapter.updateTask(task.id, { completed: true })
      expect(done.completedAt).not.toBeNull()
      expect(typeof done.completedAt).toBe('string')
      const undone = await adapter.updateTask(task.id, { completed: false })
      expect(undone.completedAt).toBeNull()
    })

    it('explicit null clears notes and dueDate', async () => {
      const task = makeTask({ notes: 'keep?', dueDate: '2026-09-08' })
      await adapter.createTask(task)
      const updated = await adapter.updateTask(task.id, { notes: null, dueDate: null })
      expect(updated.notes).toBeNull()
      expect(updated.dueDate).toBeNull()
    })

    it('updateTask on an unknown id fails with not_found', async () => {
      await expectRepositoryError(
        adapter.updateTask(crypto.randomUUID(), { title: 'x' }),
        'not_found',
      )
    })

    it('updateTask rejects invalid patches with validation errors', async () => {
      const task = makeTask()
      await adapter.createTask(task)
      await expectRepositoryError(adapter.updateTask(task.id, { title: '' }), 'validation')
      await expectRepositoryError(
        adapter.updateTask(task.id, { dueDate: '2026-13-45' }),
        'validation',
      )
    })

    it('deleteTask removes the row and is idempotent', async () => {
      const task = makeTask()
      await adapter.createTask(task)
      await adapter.deleteTask(task.id)
      await expect(adapter.deleteTask(task.id)).resolves.toBeUndefined()
      const data = await adapter.load()
      expect(data.tasks).toEqual([])
    })

    it('reorderTasks applies a batch of positions', async () => {
      const a = makeTask({ title: 'a', position: 1024 })
      const b = makeTask({ title: 'b', position: 2048 })
      await adapter.createTask(a)
      await adapter.createTask(b)
      await adapter.reorderTasks([
        { id: a.id, position: 2048 * 2 },
        { id: b.id, position: 1024 },
      ])
      const data = await adapter.load()
      const byId = new Map(data.tasks.map((t) => [t.id, t.position]))
      expect(byId.get(a.id)).toBe(4096)
      expect(byId.get(b.id)).toBe(1024)
    })

    it('createTask preserves a completed row (undo replay after clear-completed)', async () => {
      const task = makeTask()
      await adapter.createTask(task)
      const done = await adapter.updateTask(task.id, { completed: true })
      await adapter.clearCompleted()
      const restored = await adapter.createTask(done)
      expect(restored.id).toBe(task.id)
      expect(restored.completedAt).not.toBeNull()
      const data = await adapter.load()
      expect(data.tasks).toHaveLength(1)
      expect(data.tasks[0].completedAt).not.toBeNull()
    })

    it('reorderTasks rejects a non-positive position and writes nothing', async () => {
      const a = makeTask({ position: 1024 })
      await adapter.createTask(a)
      await expectRepositoryError(
        adapter.reorderTasks([{ id: a.id, position: 0 }]),
        'validation',
      )
      const data = await adapter.load()
      expect(data.tasks[0].position).toBe(1024)
    })

    it('reorderTasks rolls the whole batch back when any id is unknown', async () => {
      const a = makeTask({ position: 1024 })
      await adapter.createTask(a)
      await expectRepositoryError(
        adapter.reorderTasks([
          { id: a.id, position: 9999 },
          { id: crypto.randomUUID(), position: 1 },
        ]),
        'not_found',
      )
      const data = await adapter.load()
      expect(data.tasks[0].position).toBe(1024) // untouched
    })

    it('clearCompleted deletes only completed tasks and returns their ids', async () => {
      const active = makeTask({ title: 'active', position: 1024 })
      const done = makeTask({ title: 'done', position: 2048 })
      await adapter.createTask(active)
      await adapter.createTask(done)
      await adapter.updateTask(done.id, { completed: true })
      const deletedIds = await adapter.clearCompleted()
      expect(deletedIds).toEqual([done.id])
      const data = await adapter.load()
      expect(data.tasks.map((t) => t.id)).toEqual([active.id])
    })

    it('createTag persists and rejects duplicate names case-insensitively', async () => {
      const tag = makeTag({ name: 'Work' })
      const saved = await adapter.createTag(tag)
      expect(saved.name).toBe('Work')
      expect(saved.color).toBe('#5B5BD6')
      await expectRepositoryError(adapter.createTag(makeTag({ name: 'wORK' })), 'conflict')
    })

    it("createTag rejects accent-variant duplicates ('café' after 'cafe') like MySQL ai_ci", async () => {
      await adapter.createTag(makeTag({ name: 'cafe' }))
      await expectRepositoryError(adapter.createTag(makeTag({ name: 'café' })), 'conflict')
    })

    it('updateTag rejects renaming onto an accent-variant of another tag', async () => {
      await adapter.createTag(makeTag({ name: 'café' }))
      const other = makeTag({ name: 'other' })
      await adapter.createTag(other)
      await expectRepositoryError(adapter.updateTag(other.id, { name: 'Cafe' }), 'conflict')
    })

    it('createTag validates name and color', async () => {
      await expectRepositoryError(adapter.createTag(makeTag({ name: '  ' })), 'validation')
      await expectRepositoryError(adapter.createTag(makeTag({ color: 'blue' })), 'validation')
    })

    it('updateTag renames; unknown id is not_found', async () => {
      const tag = makeTag({ name: 'home' })
      await adapter.createTag(tag)
      const renamed = await adapter.updateTag(tag.id, { name: 'house', color: null })
      expect(renamed.name).toBe('house')
      expect(renamed.color).toBeNull()
      await expectRepositoryError(adapter.updateTag(crypto.randomUUID(), { name: 'x' }), 'not_found')
    })

    it('deleteTag cascades tag references off tasks (tasks keep other tags)', async () => {
      const keep = makeTag({ name: 'keep' })
      const drop = makeTag({ name: 'drop' })
      await adapter.createTag(keep)
      await adapter.createTag(drop)
      const task = makeTask({ tagIds: [keep.id, drop.id] })
      await adapter.createTask(task)
      await adapter.deleteTag(drop.id)
      const data = await adapter.load()
      expect(data.tags.map((t) => t.id)).toEqual([keep.id])
      expect(data.tasks[0].tagIds).toEqual([keep.id])
    })

    it('exportData returns the same envelope shape as load', async () => {
      const tag = makeTag()
      await adapter.createTag(tag)
      const task = makeTask({ tagIds: [tag.id] })
      await adapter.createTask(task)
      const exported = await adapter.exportData()
      expect(exported.schemaVersion).toBe(2)
      expect(exported.tasks.map((t) => t.id)).toEqual([task.id])
      expect(exported.tags.map((t) => t.id)).toEqual([tag.id])
    })

    it('importData upserts by id, skipping existing rows', async () => {
      const existing = makeTask({ title: 'existing' })
      await adapter.createTask(existing)
      const incomingTag = makeTag({ name: 'imported' })
      const incoming = makeTask({ title: 'incoming', position: 4096, tagIds: [incomingTag.id] })
      await adapter.importData({
        schemaVersion: 2,
        tasks: [{ ...existing, title: 'MUST NOT OVERWRITE' }, incoming],
        tags: [incomingTag],
      })
      const data = await adapter.load()
      expect(data.tasks).toHaveLength(2)
      expect(data.tasks.find((t) => t.id === existing.id)?.title).toBe('existing')
      expect(data.tasks.find((t) => t.id === incoming.id)?.title).toBe('incoming')
      expect(data.tags.map((t) => t.id)).toEqual([incomingTag.id])
    })

    it('importData rejects malformed rows with a validation error and writes nothing', async () => {
      const error = await expectRepositoryError(
        adapter.importData({
          schemaVersion: 2,
          tasks: [
            { ...makeTask(), title: '' }, // blank title
            { ...makeTask(), tagIds: 'nope' } as unknown as Task, // structural break
          ],
          tags: [],
        }),
        'validation',
      )
      expect(error.fieldErrors?.length).toBeGreaterThan(0)
      const data = await adapter.load()
      expect(data.tasks).toEqual([])
    })

    it('importData rejects unknown tag references', async () => {
      await expectRepositoryError(
        adapter.importData({
          schemaVersion: 2,
          tasks: [makeTask({ tagIds: [crypto.randomUUID()] })],
          tags: [],
        }),
        'validation',
      )
    })

    it('importData rejects a new tag whose name duplicates an existing tag', async () => {
      await adapter.createTag(makeTag({ name: 'work' }))
      await expectRepositoryError(
        adapter.importData({
          schemaVersion: 2,
          tasks: [],
          tags: [makeTag({ name: 'WORK' })], // different id, same name
        }),
        'conflict',
      )
      const data = await adapter.load()
      expect(data.tags).toHaveLength(1)
    })
  })
}

// ---- LocalStorageAdapter (direct) -----------------------------------------

adapterContractSuite('LocalStorageAdapter', async () => {
  localStorage.clear()
  const adapter = new LocalStorageAdapter(localStorage)
  await adapter.init()
  return adapter
})

describe('LocalStorageAdapter multi-tab reconcile', () => {
  it('notifies subscribers when another tab writes the envelope', async () => {
    localStorage.clear()
    const adapter = new LocalStorageAdapter(localStorage)
    await adapter.init()
    let notified = 0
    const unsubscribe = adapter.subscribeExternalChanges(() => {
      notified++
    })
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'todo.app.v2', newValue: '{}' }),
    )
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated.key', newValue: 'x' }))
    expect(notified).toBe(1)
    unsubscribe()
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'todo.app.v2', newValue: '{}' }),
    )
    expect(notified).toBe(1)
  })
})

// ---- ApiAdapter (over MSW) -------------------------------------------------

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

adapterContractSuite('ApiAdapter over MSW', async () => {
  resetDb()
  const adapter = new ApiAdapter(API_BASE)
  await adapter.init() // GET /health
  return adapter
})
