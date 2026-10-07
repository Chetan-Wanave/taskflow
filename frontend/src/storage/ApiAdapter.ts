import type { AppData, Tag, Task } from '../domain/types'
import { RepositoryError } from './StorageAdapter'
import type { StorageAdapter, TaskPatch } from './StorageAdapter'

interface ProblemDetail {
  title?: string
  detail?: string
  errors?: { field: string; message: string }[]
}

/** Thin fetch client for the REST contract (SPEC.md §REST API contract). */
export class ApiAdapter implements StorageAdapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async init(): Promise<void> {
    const health = await this.request<{ status: string }>('GET', '/health')
    if (health.status !== 'ok') {
      throw new RepositoryError('server', 'API reported an unhealthy status')
    }
  }

  async load(): Promise<AppData> {
    const [tasks, tags] = await Promise.all([
      this.request<Task[]>('GET', '/tasks?status=all'),
      this.request<Tag[]>('GET', '/tags'),
    ])
    return { schemaVersion: 2, tasks, tags }
  }

  async createTask(task: Task): Promise<Task> {
    const created = await this.request<Task>('POST', '/tasks', {
      id: task.id,
      title: task.title,
      notes: task.notes,
      priority: task.priority,
      dueDate: task.dueDate,
      position: task.position,
      parentId: task.parentId,
      tagIds: task.tagIds,
    })
    // POST /tasks has no completed field (the server stamps completedAt), so a
    // completed row — an undo replay after clear-completed — needs a follow-up
    // PATCH or the restored task would silently come back active.
    if (task.completedAt !== null) {
      return this.request<Task>('PATCH', `/tasks/${created.id}`, { completed: true })
    }
    return created
  }

  updateTask(id: string, patch: TaskPatch): Promise<Task> {
    return this.request<Task>('PATCH', `/tasks/${id}`, patch)
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<void>('DELETE', `/tasks/${id}`)
  }

  async reorderTasks(positions: { id: string; position: number }[]): Promise<void> {
    await this.request<void>('PUT', '/tasks/positions', { positions })
  }

  async clearCompleted(): Promise<string[]> {
    const result = await this.request<{ deletedIds: string[] }>('POST', '/tasks/clear-completed')
    return result.deletedIds
  }

  createTag(tag: Tag): Promise<Tag> {
    return this.request<Tag>('POST', '/tags', {
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })
  }

  updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag> {
    return this.request<Tag>('PATCH', `/tags/${id}`, patch)
  }

  async deleteTag(id: string): Promise<void> {
    await this.request<void>('DELETE', `/tags/${id}`)
  }

  exportData(): Promise<AppData> {
    return this.request<AppData>('GET', '/export')
  }

  async importData(data: AppData): Promise<void> {
    await this.request<{ importedTasks: number; importedTags: number; skippedExisting: number }>(
      'POST',
      '/import',
      data,
    )
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch {
      throw new RepositoryError('network', 'Could not reach the Taskflow API — is the backend running?')
    }
    if (!response.ok) {
      throw await this.toError(response)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  private async toError(response: Response): Promise<RepositoryError> {
    let problem: ProblemDetail = {}
    try {
      problem = (await response.json()) as ProblemDetail
    } catch {
      // non-JSON error body
    }
    const message = problem.detail ?? problem.title ?? `Request failed (${response.status})`
    switch (response.status) {
      case 400:
        return new RepositoryError('validation', message, problem.errors)
      case 404:
        return new RepositoryError('not_found', message)
      case 409:
        return new RepositoryError('conflict', message)
      default:
        return new RepositoryError('server', message)
    }
  }
}
