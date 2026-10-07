// Pure mutation functions applied optimistically by store actions and used by
// LocalStorageAdapter, so local semantics match the server exactly.

import { appendPosition } from './position'
import type { Priority, Task } from './types'

export interface NewTaskInput {
  title: string
  notes?: string | null
  priority?: Priority
  dueDate?: string | null
  tagIds?: string[]
}

export function buildTask(input: NewTaskInput, existingPositions: number[], now: string): Task {
  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    notes: input.notes ?? null,
    priority: input.priority ?? 'NONE',
    dueDate: input.dueDate ?? null,
    completedAt: null,
    position: appendPosition(existingPositions),
    parentId: null,
    tagIds: input.tagIds ?? [],
    createdAt: now,
    updatedAt: now,
  }
}

export interface TaskPatchFields {
  title?: string
  notes?: string | null
  priority?: Priority
  dueDate?: string | null
  position?: number
  tagIds?: string[]
  completed?: boolean
}

/** Apply a patch. Absent = unchanged; explicit null clears notes/dueDate;
 * completed:boolean stamps/clears completedAt on the executing side. */
export function applyTaskPatch(task: Task, patch: TaskPatchFields, now: string): Task {
  const next: Task = { ...task, updatedAt: now }
  if (patch.title !== undefined) next.title = patch.title.trim()
  if (patch.notes !== undefined) next.notes = patch.notes
  if (patch.priority !== undefined) next.priority = patch.priority
  if (patch.dueDate !== undefined) next.dueDate = patch.dueDate
  if (patch.position !== undefined) next.position = patch.position
  if (patch.tagIds !== undefined) next.tagIds = [...patch.tagIds]
  if (patch.completed !== undefined) {
    next.completedAt = patch.completed ? now : null
  }
  return next
}

export function sortByPosition(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => a.position - b.position)
}
