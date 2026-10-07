import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '../domain/types'
import { CORRUPT_KEY, LEGACY_KEY, STORAGE_KEY, runMigration } from '../storage/migration'

function readEnvelope(): AppData {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as AppData
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('v1 → v2 migration', () => {
  it('maps legacy items {id, text, done, priority, due} to v2 tasks', () => {
    const createdMs = 1725500000000 // legacy Date.now() id doubles as createdAt
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        { id: createdMs, text: '  Buy milk  ', done: false, priority: 'high', due: '2026-01-01' },
        { id: 2, text: 'Old done task', done: true, priority: 'weird', due: 'not-a-date' },
        { id: 3, text: 'No priority', done: false, priority: '', due: '' },
      ]),
    )

    runMigration(localStorage)
    const data = readEnvelope()

    expect(data.schemaVersion).toBe(2)
    expect(data.tags).toEqual([])
    expect(data.tasks).toHaveLength(3)

    const [first, second, third] = data.tasks
    expect(first.title).toBe('Buy milk') // trimmed
    expect(first.priority).toBe('HIGH')
    expect(first.dueDate).toBe('2026-01-01')
    expect(first.completedAt).toBeNull()
    expect(first.position).toBe(1024)
    expect(first.createdAt).toBe(new Date(createdMs).toISOString())
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(first.notes).toBeNull()
    expect(first.parentId).toBeNull()
    expect(first.tagIds).toEqual([])

    expect(second.priority).toBe('NONE') // unrecognized → NONE
    expect(second.dueDate).toBeNull() // invalid date → null
    expect(second.completedAt).not.toBeNull() // done → stamped now
    expect(second.position).toBe(2048)
    expect(second.createdAt).not.toBe(new Date(2).toISOString()) // small id → now

    expect(third.priority).toBe('NONE')
    expect(third.dueDate).toBeNull()
    expect(third.position).toBe(3072)
  })

  it('rejects non-real calendar dates', () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([{ id: 1, text: 'x', done: false, priority: 'low', due: '2026-02-30' }]),
    )
    runMigration(localStorage)
    expect(readEnvelope().tasks[0].dueDate).toBeNull()
  })

  it('drops items whose title is empty after trim, keeping order dense', () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        { id: 1, text: '   ', done: false, priority: 'low', due: '' },
        { id: 2, text: 'kept', done: false, priority: 'low', due: '' },
      ]),
    )
    runMigration(localStorage)
    const data = readEnvelope()
    expect(data.tasks).toHaveLength(1)
    expect(data.tasks[0].title).toBe('kept')
    expect(data.tasks[0].position).toBe(1024)
  })

  it('truncates titles to 500 chars', () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([{ id: 1, text: 'a'.repeat(600), done: false, priority: 'low', due: '' }]),
    )
    runMigration(localStorage)
    expect(readEnvelope().tasks[0].title).toHaveLength(500)
  })

  it('never writes or deletes the legacy key', () => {
    const legacyRaw = JSON.stringify([{ id: 1, text: 'x', done: false, priority: 'low', due: '' }])
    localStorage.setItem(LEGACY_KEY, legacyRaw)
    runMigration(localStorage)
    expect(localStorage.getItem(LEGACY_KEY)).toBe(legacyRaw)
  })

  it('writes a fresh empty envelope when no keys exist', () => {
    runMigration(localStorage)
    expect(readEnvelope()).toEqual({ schemaVersion: 2, tasks: [], tags: [] })
  })

  it('is a no-op when a valid v2 envelope already exists (run-once)', () => {
    const existing: AppData = { schemaVersion: 2, tasks: [], tags: [] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([{ id: 1, text: 'should not migrate', done: false, priority: 'low', due: '' }]),
    )
    runMigration(localStorage)
    expect(readEnvelope().tasks).toEqual([]) // legacy not re-imported
  })

  it('preserves a corrupt v2 value aside and starts empty, never throwing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(() => runMigration(localStorage)).not.toThrow()
    expect(localStorage.getItem(CORRUPT_KEY)).toBe('{not json')
    expect(readEnvelope()).toEqual({ schemaVersion: 2, tasks: [], tags: [] })
    expect(consoleError).toHaveBeenCalled()
  })

  it('treats a parseable but wrong-shape v2 value as corrupt', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }))
    runMigration(localStorage)
    expect(localStorage.getItem(CORRUPT_KEY)).toBe(JSON.stringify({ schemaVersion: 99 }))
    expect(readEnvelope()).toEqual({ schemaVersion: 2, tasks: [], tags: [] })
  })

  it('starts empty on corrupt legacy JSON, keeping the legacy key', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(LEGACY_KEY, '[{"id": 1,')
    runMigration(localStorage)
    expect(readEnvelope()).toEqual({ schemaVersion: 2, tasks: [], tags: [] })
    expect(localStorage.getItem(LEGACY_KEY)).toBe('[{"id": 1,')
    expect(consoleWarn).toHaveBeenCalled()
  })

  it('starts empty when the legacy value is not an array', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ id: 1, text: 'obj' }))
    runMigration(localStorage)
    expect(readEnvelope()).toEqual({ schemaVersion: 2, tasks: [], tags: [] })
    expect(consoleWarn).toHaveBeenCalled()
  })
})
