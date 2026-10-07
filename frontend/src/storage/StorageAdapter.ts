import type { AppData, Tag, Task } from '../domain/types'

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'notes' | 'priority' | 'dueDate' | 'position' | 'tagIds'>
> & { completed?: boolean }

export interface StorageAdapter {
  init(): Promise<void> // local: run migration; api: GET /health
  load(): Promise<AppData>
  createTask(task: Task): Promise<Task> // client supplies full row incl. id + position
  updateTask(id: string, patch: TaskPatch): Promise<Task>
  deleteTask(id: string): Promise<void>
  reorderTasks(positions: { id: string; position: number }[]): Promise<void>
  clearCompleted(): Promise<string[]> // deleted ids
  createTag(tag: Tag): Promise<Tag>
  updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag>
  deleteTag(id: string): Promise<void>
  exportData(): Promise<AppData>
  importData(data: AppData): Promise<void>
}

export type RepositoryErrorKind = 'validation' | 'conflict' | 'not_found' | 'network' | 'server'

export class RepositoryError extends Error {
  readonly kind: RepositoryErrorKind
  readonly fieldErrors?: { field: string; message: string }[]

  constructor(
    kind: RepositoryErrorKind,
    message: string,
    fieldErrors?: { field: string; message: string }[],
  ) {
    super(message)
    this.name = 'RepositoryError'
    this.kind = kind
    this.fieldErrors = fieldErrors
  }
}

/** Optional capability: adapters that can signal out-of-band data changes
 * (LocalStorageAdapter uses the window 'storage' event for multi-tab reconcile). */
export interface ExternalChangeSource {
  subscribeExternalChanges(listener: () => void): () => void
}

export function supportsExternalChanges(
  adapter: StorageAdapter,
): adapter is StorageAdapter & ExternalChangeSource {
  return typeof (adapter as Partial<ExternalChangeSource>).subscribeExternalChanges === 'function'
}
