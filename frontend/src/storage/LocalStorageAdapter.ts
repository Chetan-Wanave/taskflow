import { applyTaskPatch } from '../domain/mutations'
import type { AppData, Tag, Task } from '../domain/types'
import { emptyAppData } from '../domain/types'
import {
  tagNameKey,
  validateImportData,
  validatePosition,
  validateTag,
  validateTask,
  validateTaskPatch,
} from '../domain/validation'
import { runMigration, STORAGE_KEY } from './migration'
import { RepositoryError } from './StorageAdapter'
import type { ExternalChangeSource, StorageAdapter, TaskPatch } from './StorageAdapter'

export class LocalStorageAdapter implements StorageAdapter, ExternalChangeSource {
  private readonly storage: Storage
  private readonly listeners = new Set<() => void>()
  private storageEventBound = false

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
  }

  init(): Promise<void> {
    try {
      runMigration(this.storage)
    } catch (error) {
      return Promise.reject(toStorageError(error))
    }
    return Promise.resolve()
  }

  load(): Promise<AppData> {
    return Promise.resolve(this.read())
  }

  createTask(task: Task): Promise<Task> {
    const data = this.read()
    if (data.tasks.some((t) => t.id === task.id)) {
      return Promise.reject(new RepositoryError('conflict', `Task ${task.id} already exists`))
    }
    const errors = validateTask(task, new Set(data.tags.map((t) => t.id)))
    if (errors.length > 0) {
      return Promise.reject(new RepositoryError('validation', 'Validation failed', errors))
    }
    // Trim like the server does, so both adapters persist identical rows.
    const stored: Task = { ...task, title: task.title.trim(), tagIds: [...task.tagIds] }
    data.tasks.push(stored)
    this.write(data)
    return Promise.resolve({ ...stored, tagIds: [...stored.tagIds] })
  }

  updateTask(id: string, patch: TaskPatch): Promise<Task> {
    const data = this.read()
    const index = data.tasks.findIndex((t) => t.id === id)
    if (index === -1) {
      return Promise.reject(new RepositoryError('not_found', `Task ${id} not found`))
    }
    const errors = validateTaskPatch(patch, new Set(data.tags.map((t) => t.id)))
    if (errors.length > 0) {
      return Promise.reject(new RepositoryError('validation', 'Validation failed', errors))
    }
    const updated = applyTaskPatch(data.tasks[index], patch, new Date().toISOString())
    data.tasks[index] = updated
    this.write(data)
    return Promise.resolve({ ...updated, tagIds: [...updated.tagIds] })
  }

  deleteTask(id: string): Promise<void> {
    // Idempotent, mirroring DELETE /tasks/{id} → 204 even when missing.
    const data = this.read()
    const next = data.tasks.filter((t) => t.id !== id)
    if (next.length !== data.tasks.length) {
      data.tasks = next
      this.write(data)
    }
    return Promise.resolve()
  }

  reorderTasks(positions: { id: string; position: number }[]): Promise<void> {
    const data = this.read()
    const byId = new Map(data.tasks.map((t) => [t.id, t]))
    // Whole batch validated before any write (transactional).
    for (const { id, position } of positions) {
      const errors = validatePosition(position)
      if (errors.length > 0) {
        return Promise.reject(new RepositoryError('validation', 'Validation failed', errors))
      }
      if (!byId.has(id)) {
        return Promise.reject(new RepositoryError('not_found', `Task ${id} not found`))
      }
    }
    const now = new Date().toISOString()
    for (const { id, position } of positions) {
      const task = byId.get(id) as Task
      task.position = position
      task.updatedAt = now
    }
    this.write(data)
    return Promise.resolve()
  }

  clearCompleted(): Promise<string[]> {
    const data = this.read()
    const deletedIds = data.tasks.filter((t) => t.completedAt !== null).map((t) => t.id)
    if (deletedIds.length > 0) {
      data.tasks = data.tasks.filter((t) => t.completedAt === null)
      this.write(data)
    }
    return Promise.resolve(deletedIds)
  }

  createTag(tag: Tag): Promise<Tag> {
    const data = this.read()
    if (data.tags.some((t) => t.id === tag.id)) {
      return Promise.reject(new RepositoryError('conflict', `Tag ${tag.id} already exists`))
    }
    const errors = validateTag(tag)
    if (errors.length > 0) {
      return Promise.reject(new RepositoryError('validation', 'Validation failed', errors))
    }
    const name = tag.name.trim()
    // Case- AND accent-insensitive, matching MySQL utf8mb4_0900_ai_ci.
    if (data.tags.some((t) => tagNameKey(t.name) === tagNameKey(name))) {
      return Promise.reject(new RepositoryError('conflict', `Tag '${name}' already exists`))
    }
    const stored: Tag = { ...tag, name }
    data.tags.push(stored)
    this.write(data)
    return Promise.resolve({ ...stored })
  }

  updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag> {
    const data = this.read()
    const index = data.tags.findIndex((t) => t.id === id)
    if (index === -1) {
      return Promise.reject(new RepositoryError('not_found', `Tag ${id} not found`))
    }
    const current = data.tags[index]
    const next: Tag = {
      ...current,
      name: patch.name !== undefined ? patch.name.trim() : current.name,
      color: patch.color !== undefined ? patch.color : current.color,
    }
    const errors = validateTag(next)
    if (errors.length > 0) {
      return Promise.reject(new RepositoryError('validation', 'Validation failed', errors))
    }
    if (
      data.tags.some((t) => t.id !== id && tagNameKey(t.name) === tagNameKey(next.name))
    ) {
      return Promise.reject(new RepositoryError('conflict', `Tag '${next.name}' already exists`))
    }
    data.tags[index] = next
    this.write(data)
    return Promise.resolve({ ...next })
  }

  deleteTag(id: string): Promise<void> {
    const data = this.read()
    const next = data.tags.filter((t) => t.id !== id)
    if (next.length !== data.tags.length) {
      data.tags = next
      // Cascade join rows only — tasks keep their other tags.
      for (const task of data.tasks) {
        if (task.tagIds.includes(id)) {
          task.tagIds = task.tagIds.filter((tagId) => tagId !== id)
        }
      }
      this.write(data)
    }
    return Promise.resolve()
  }

  exportData(): Promise<AppData> {
    return Promise.resolve(this.read())
  }

  importData(data: AppData): Promise<void> {
    // Upsert-by-id: unknown ids are inserted, existing ids are skipped.
    // Validated like the server's POST /import — a bad file rejects the whole
    // import (transactional) instead of planting malformed rows in storage.
    const current = this.read()
    const { tasks, tags, errors } = validateImportData(
      data,
      new Set(current.tags.map((t) => t.id)),
    )
    if (errors.length > 0) {
      return Promise.reject(new RepositoryError('validation', 'Import validation failed', errors))
    }
    const taskIds = new Set(current.tasks.map((t) => t.id))
    const tagIds = new Set(current.tags.map((t) => t.id))
    const tagNames = new Set(current.tags.map((t) => tagNameKey(t.name)))
    const newTags = tags.filter((t) => !tagIds.has(t.id))
    for (const tag of newTags) {
      const key = tagNameKey(tag.name)
      if (tagNames.has(key)) {
        return Promise.reject(new RepositoryError('conflict', `Tag '${tag.name}' already exists`))
      }
      tagNames.add(key)
    }
    current.tags.push(...newTags)
    for (const task of tasks) {
      if (!taskIds.has(task.id)) current.tasks.push(task)
    }
    this.write(current)
    return Promise.resolve()
  }

  /** Multi-tab reconcile: notify when another tab writes the envelope. */
  subscribeExternalChanges(listener: () => void): () => void {
    this.listeners.add(listener)
    if (!this.storageEventBound && typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorageEvent)
      this.storageEventBound = true
    }
    return () => {
      this.listeners.delete(listener)
    }
  }

  private onStorageEvent = (event: StorageEvent): void => {
    if (event.key === null || event.key === STORAGE_KEY) {
      for (const listener of this.listeners) listener()
    }
  }

  private read(): AppData {
    const raw = this.storage.getItem(STORAGE_KEY)
    if (raw === null) return emptyAppData()
    try {
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as AppData).schemaVersion === 2 &&
        Array.isArray((parsed as AppData).tasks) &&
        Array.isArray((parsed as AppData).tags)
      ) {
        return parsed as AppData
      }
    } catch {
      // treated as empty below
    }
    return emptyAppData()
  }

  private write(data: AppData): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      throw toStorageError(error)
    }
  }
}

function toStorageError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error
  const isQuota = error instanceof DOMException && error.name === 'QuotaExceededError'
  return new RepositoryError(
    'server',
    isQuota ? 'Browser storage is full — free up space and retry' : 'Browser storage failed',
  )
}
