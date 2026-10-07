// One-time localStorage v1 → v2 migration (Migration plan, Phase A).
// The legacy key is NEVER written or deleted — it is the rollback artifact.

import { isDateString } from '../domain/dates'
import { GAP } from '../domain/position'
import type { AppData, Priority, Task } from '../domain/types'
import { emptyAppData } from '../domain/types'

export const STORAGE_KEY = 'todo.app.v2'
export const CORRUPT_KEY = 'todo.app.v2.corrupt'
export const LEGACY_KEY = 'todo-app-items'
export const THEME_KEY = 'todo.app.theme'

function isEnvelope(value: unknown): value is AppData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === 2 &&
    Array.isArray((value as { tasks?: unknown }).tasks) &&
    Array.isArray((value as { tags?: unknown }).tags)
  )
}

function legacyPriority(value: unknown): Priority {
  return typeof value === 'string' && ['low', 'medium', 'high'].includes(value)
    ? (value.toUpperCase() as Priority)
    : 'NONE'
}

function legacyDueDate(value: unknown): string | null {
  return typeof value === 'string' && isDateString(value) ? value : null
}

function legacyCreatedAt(id: unknown, nowISO: string): string {
  // Legacy ids were Date.now() values — they double as creation timestamps.
  return typeof id === 'number' && Number.isFinite(id) && id > 1e12
    ? new Date(id).toISOString()
    : nowISO
}

function migrateLegacyItems(items: unknown[], nowISO: string): Task[] {
  const tasks: Task[] = []
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const legacy = item as { id?: unknown; text?: unknown; done?: unknown; priority?: unknown; due?: unknown }
    const title = String(legacy.text ?? '').trim().slice(0, 500)
    if (title.length === 0) continue // drop items with empty titles
    tasks.push({
      id: crypto.randomUUID(),
      title,
      notes: null,
      priority: legacyPriority(legacy.priority),
      dueDate: legacyDueDate(legacy.due),
      completedAt: legacy.done === true ? nowISO : null,
      position: (tasks.length + 1) * GAP, // preserves original order
      parentId: null,
      tagIds: [],
      createdAt: legacyCreatedAt(legacy.id, nowISO),
      updatedAt: nowISO,
    })
  }
  return tasks
}

/**
 * Runs once before the first read. Guarantees 'todo.app.v2' holds a valid
 * envelope afterwards; never throws on boot.
 */
export function runMigration(storage: Storage): void {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isEnvelope(parsed)) return // already migrated
    } catch {
      // fall through to corrupt handling
    }
    // Corrupt v2 value: preserve it aside, start empty, never throw.
    storage.setItem(CORRUPT_KEY, raw)
    console.error(
      `Taskflow: '${STORAGE_KEY}' was corrupt; raw value copied to '${CORRUPT_KEY}', starting empty.`,
    )
    storage.setItem(STORAGE_KEY, JSON.stringify(emptyAppData()))
    return
  }

  const legacyRaw = storage.getItem(LEGACY_KEY)
  if (legacyRaw === null) {
    storage.setItem(STORAGE_KEY, JSON.stringify(emptyAppData()))
    return
  }

  const nowISO = new Date().toISOString()
  let tasks: Task[] = []
  try {
    const parsed: unknown = JSON.parse(legacyRaw)
    if (Array.isArray(parsed)) {
      tasks = migrateLegacyItems(parsed, nowISO)
    } else {
      console.warn(`Taskflow: legacy '${LEGACY_KEY}' is not an array; starting empty.`)
    }
  } catch {
    console.warn(`Taskflow: legacy '${LEGACY_KEY}' is not valid JSON; starting empty.`)
  }

  const envelope: AppData = { schemaVersion: 2, tasks, tags: [] }
  storage.setItem(STORAGE_KEY, JSON.stringify(envelope))
}
