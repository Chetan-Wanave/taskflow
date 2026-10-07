// Shared validation rules — used by the QuickAdd composer and by BOTH storage
// adapters, so the local path exercises the same rules the server enforces.

import { isDateString } from './dates'
import { isPriority } from './priority'
import type { AppData, Priority, Tag, Task } from './types'

export interface FieldError {
  field: string
  message: string
}

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/

/**
 * Canonical comparison key for tag-name uniqueness. The server's UNIQUE index
 * (uq_tags_user_name) uses MySQL utf8mb4_0900_ai_ci, which is case- AND
 * accent-insensitive — 'café' collides with 'cafe'. Both local adapters
 * (LocalStorageAdapter and the MSW mock backing the contract suite) must
 * compare with the same semantics, or a tag that saves locally would 409 on
 * the flip to API mode. NFD + strip combining marks + lowercase mirrors ai_ci
 * for the characters tag names realistically use.
 */
export function tagNameKey(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function validateTitle(title: unknown): FieldError[] {
  if (typeof title !== 'string' || title.trim().length === 0) {
    return [{ field: 'title', message: 'must not be blank' }]
  }
  if (title.trim().length > 500) {
    return [{ field: 'title', message: 'must be at most 500 characters' }]
  }
  return []
}

export function validateNotes(notes: unknown): FieldError[] {
  if (notes === null) return []
  if (typeof notes !== 'string') return [{ field: 'notes', message: 'must be a string or null' }]
  if (notes.length > 10_000) return [{ field: 'notes', message: 'must be at most 10000 characters' }]
  return []
}

export function validateDueDate(dueDate: unknown): FieldError[] {
  if (dueDate === null) return []
  if (typeof dueDate !== 'string' || !isDateString(dueDate)) {
    return [{ field: 'dueDate', message: 'must be a real calendar date in YYYY-MM-DD format' }]
  }
  return []
}

export function validatePosition(position: unknown): FieldError[] {
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 1) {
    return [{ field: 'position', message: 'must be an integer greater than 0' }]
  }
  return []
}

export function validateTask(task: Task, existingTagIds: ReadonlySet<string>): FieldError[] {
  const errors: FieldError[] = [
    ...validateTitle(task.title),
    ...validateNotes(task.notes),
    ...validateDueDate(task.dueDate),
    ...validatePosition(task.position),
  ]
  if (!isPriority(task.priority)) {
    errors.push({ field: 'priority', message: 'must be one of NONE, LOW, MEDIUM, HIGH' })
  }
  for (const tagId of task.tagIds) {
    if (!existingTagIds.has(tagId)) {
      errors.push({ field: 'tagIds', message: `unknown tag id ${tagId}` })
    }
  }
  return errors
}

export interface TaskPatchLike {
  title?: string
  notes?: string | null
  priority?: unknown
  dueDate?: string | null
  position?: number
  tagIds?: string[]
  completed?: boolean
}

export function validateTaskPatch(
  patch: TaskPatchLike,
  existingTagIds: ReadonlySet<string>,
): FieldError[] {
  const errors: FieldError[] = []
  if (patch.title !== undefined) errors.push(...validateTitle(patch.title))
  if (patch.notes !== undefined) errors.push(...validateNotes(patch.notes))
  if (patch.dueDate !== undefined) errors.push(...validateDueDate(patch.dueDate))
  if (patch.position !== undefined) errors.push(...validatePosition(patch.position))
  if (patch.priority !== undefined && !isPriority(patch.priority)) {
    errors.push({ field: 'priority', message: 'must be one of NONE, LOW, MEDIUM, HIGH' })
  }
  if (patch.tagIds !== undefined) {
    for (const tagId of patch.tagIds) {
      if (!existingTagIds.has(tagId)) {
        errors.push({ field: 'tagIds', message: `unknown tag id ${tagId}` })
      }
    }
  }
  return errors
}

/**
 * Validates and normalizes an import envelope the way the server's POST /import
 * would (shape checks + the same field rules), so a hand-edited file can never
 * plant malformed rows in localStorage. Returns normalized rows to insert plus
 * every violation found; a non-empty `errors` means the whole import must be
 * rejected (transactional — nothing written).
 */
export interface ImportValidationResult {
  tasks: Task[]
  tags: Tag[]
  errors: FieldError[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function prefixed(prefix: string, errors: FieldError[]): FieldError[] {
  return errors.map((e) => ({ field: `${prefix}.${e.field}`, message: e.message }))
}

export function validateImportData(
  data: AppData,
  existingTagIds: ReadonlySet<string>,
): ImportValidationResult {
  const errors: FieldError[] = []
  const tags: Tag[] = []
  const tasks: Task[] = []
  const knownTagIds = new Set(existingTagIds)
  const nowISO = new Date().toISOString()

  const rawTags: unknown[] = data.tags
  rawTags.forEach((item, i) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
      errors.push({ field: `tags[${i}]`, message: 'must be a tag object with string id and name' })
      return
    }
    knownTagIds.add(item.id) // avoid noise on task tagId refs even when the tag is invalid
    const candidate: Tag = {
      id: item.id,
      name: item.name,
      color: (item.color ?? null) as string | null,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : nowISO,
    }
    const tagErrors = validateTag(candidate)
    if (tagErrors.length > 0) {
      errors.push(...prefixed(`tags[${i}]`, tagErrors))
      return
    }
    tags.push({ ...candidate, name: candidate.name.trim() })
  })

  const rawTasks: unknown[] = data.tasks
  rawTasks.forEach((item, i) => {
    if (!isRecord(item) || typeof item.id !== 'string') {
      errors.push({ field: `tasks[${i}]`, message: 'must be a task object with a string id' })
      return
    }
    const tagIds = item.tagIds ?? []
    if (!Array.isArray(tagIds) || tagIds.some((id) => typeof id !== 'string')) {
      errors.push({ field: `tasks[${i}].tagIds`, message: 'must be an array of tag id strings' })
      return
    }
    const completedAt = item.completedAt ?? null
    if (completedAt !== null && typeof completedAt !== 'string') {
      errors.push({ field: `tasks[${i}].completedAt`, message: 'must be a timestamp string or null' })
      return
    }
    const parentId = item.parentId ?? null
    if (parentId !== null && typeof parentId !== 'string') {
      errors.push({ field: `tasks[${i}].parentId`, message: 'must be a task id string or null' })
      return
    }
    const candidate: Task = {
      id: item.id,
      title: item.title as string,
      notes: (item.notes ?? null) as string | null,
      priority: (item.priority ?? 'NONE') as Priority,
      dueDate: (item.dueDate ?? null) as string | null,
      completedAt,
      position: item.position as number,
      parentId,
      tagIds: [...(tagIds as string[])],
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : nowISO,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : nowISO,
    }
    const taskErrors = validateTask(candidate, knownTagIds)
    if (taskErrors.length > 0) {
      errors.push(...prefixed(`tasks[${i}]`, taskErrors))
      return
    }
    tasks.push({ ...candidate, title: candidate.title.trim() })
  })

  return { tasks, tags, errors }
}

export function validateTag(tag: Pick<Tag, 'name' | 'color'>): FieldError[] {
  const errors: FieldError[] = []
  if (typeof tag.name !== 'string' || tag.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'must not be blank' })
  } else if (tag.name.trim().length > 50) {
    errors.push({ field: 'name', message: 'must be at most 50 characters' })
  }
  if (tag.color !== null && (typeof tag.color !== 'string' || !COLOR_RE.test(tag.color))) {
    errors.push({ field: 'color', message: 'must match #RRGGBB' })
  }
  return errors
}
