// In-memory MSW implementation of the REST contract (SPEC.md §REST API
// contract) used to run the shared adapter suite against ApiAdapter.

import { http, HttpResponse } from 'msw'
import type { AppData, Priority, Tag, Task } from '../domain/types'
import {
  tagNameKey,
  validateImportData,
  validatePosition,
  validateTag,
  validateTaskPatch,
  validateTitle,
} from '../domain/validation'
import type { FieldError } from '../domain/validation'

export const API_BASE = 'http://localhost:8080/api/v1'

interface Db {
  tasks: Task[]
  tags: Tag[]
}

export const db: Db = { tasks: [], tags: [] }

export function resetDb(): void {
  db.tasks = []
  db.tags = []
}

function problem(status: number, title: string, errors?: FieldError[]) {
  return HttpResponse.json(
    { type: 'about:blank', title, status, detail: title, errors },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

function nowISO(): string {
  return new Date().toISOString()
}

function tagIdSet(): Set<string> {
  return new Set(db.tags.map((t) => t.id))
}

interface CreateTaskBody {
  id?: string
  title?: string
  notes?: string | null
  priority?: Priority
  dueDate?: string | null
  position?: number
  parentId?: string | null
  tagIds?: string[]
}

interface PatchTaskBody {
  title?: string
  notes?: string | null
  priority?: Priority
  dueDate?: string | null
  position?: number
  tagIds?: string[]
  completed?: boolean
}

export const handlers = [
  http.get(`${API_BASE}/health`, () => HttpResponse.json({ status: 'ok' })),

  http.get(`${API_BASE}/tasks`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? 'all'
    const search = url.searchParams.get('search')?.toLowerCase() ?? ''
    const tagId = url.searchParams.get('tagId')
    const result = db.tasks
      .filter((t) => {
        if (status === 'active' && t.completedAt !== null) return false
        if (status === 'completed' && t.completedAt === null) return false
        if (search && !t.title.toLowerCase().includes(search)) return false
        if (tagId && !t.tagIds.includes(tagId)) return false
        return true
      })
      .sort((a, b) => a.position - b.position)
    return HttpResponse.json(result)
  }),

  http.post(`${API_BASE}/tasks`, async ({ request }) => {
    const body = (await request.json()) as CreateTaskBody
    const errors = [
      ...validateTitle(body.title),
      ...validateTaskPatch(
        { notes: body.notes, priority: body.priority, dueDate: body.dueDate, position: body.position, tagIds: body.tagIds },
        tagIdSet(),
      ),
    ]
    if (errors.length > 0) return problem(400, 'Validation failed', errors)
    const id = body.id ?? crypto.randomUUID()
    if (db.tasks.some((t) => t.id === id)) return problem(409, 'Duplicate task id')
    const now = nowISO()
    const maxPos = db.tasks.reduce((max, t) => Math.max(max, t.position), 0)
    const task: Task = {
      id,
      title: (body.title as string).trim(),
      notes: body.notes ?? null,
      priority: body.priority ?? 'NONE',
      dueDate: body.dueDate ?? null,
      completedAt: null,
      position: body.position ?? maxPos + 1024,
      parentId: body.parentId ?? null,
      tagIds: body.tagIds ?? [],
      createdAt: now,
      updatedAt: now,
    }
    db.tasks.push(task)
    return HttpResponse.json(task, {
      status: 201,
      headers: { Location: `${API_BASE}/tasks/${task.id}` },
    })
  }),

  http.get(`${API_BASE}/tasks/:id`, ({ params }) => {
    const task = db.tasks.find((t) => t.id === params.id)
    return task ? HttpResponse.json(task) : problem(404, 'Task not found')
  }),

  http.patch(`${API_BASE}/tasks/:id`, async ({ params, request }) => {
    const task = db.tasks.find((t) => t.id === params.id)
    if (!task) return problem(404, 'Task not found')
    const body = (await request.json()) as PatchTaskBody
    const errors = validateTaskPatch(body, tagIdSet())
    if (errors.length > 0) return problem(400, 'Validation failed', errors)
    const now = nowISO()
    if (body.title !== undefined) task.title = body.title.trim()
    if (body.notes !== undefined) task.notes = body.notes
    if (body.priority !== undefined) task.priority = body.priority
    if (body.dueDate !== undefined) task.dueDate = body.dueDate
    if (body.position !== undefined) task.position = body.position
    if (body.tagIds !== undefined) task.tagIds = [...body.tagIds]
    if (body.completed !== undefined) task.completedAt = body.completed ? now : null
    task.updatedAt = now
    return HttpResponse.json(task)
  }),

  http.delete(`${API_BASE}/tasks/:id`, ({ params }) => {
    db.tasks = db.tasks.filter((t) => t.id !== params.id)
    return new HttpResponse(null, { status: 204 }) // idempotent
  }),

  http.put(`${API_BASE}/tasks/positions`, async ({ request }) => {
    const body = (await request.json()) as { positions: { id: string; position: number }[] }
    // Transactional: any invalid position or unknown id rolls back the whole batch.
    for (const { id, position } of body.positions) {
      const errors = validatePosition(position)
      if (errors.length > 0) return problem(400, 'Validation failed', errors)
      if (!db.tasks.some((t) => t.id === id)) return problem(404, 'Task not found')
    }
    const now = nowISO()
    for (const { id, position } of body.positions) {
      const task = db.tasks.find((t) => t.id === id) as Task
      task.position = position
      task.updatedAt = now
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_BASE}/tasks/clear-completed`, () => {
    const deletedIds = db.tasks.filter((t) => t.completedAt !== null).map((t) => t.id)
    db.tasks = db.tasks.filter((t) => t.completedAt === null)
    return HttpResponse.json({ deletedIds })
  }),

  http.get(`${API_BASE}/tags`, () => HttpResponse.json(db.tags)),

  http.post(`${API_BASE}/tags`, async ({ request }) => {
    const body = (await request.json()) as { id?: string; name: string; color?: string | null }
    const tag: Tag = {
      id: body.id ?? crypto.randomUUID(),
      name: (body.name ?? '').trim(),
      color: body.color ?? null,
      createdAt: nowISO(),
    }
    const errors = validateTag(tag)
    if (errors.length > 0) return problem(400, 'Validation failed', errors)
    if (db.tags.some((t) => t.id === tag.id)) return problem(409, 'Duplicate tag id')
    // Case- AND accent-insensitive, matching the real MySQL utf8mb4_0900_ai_ci index.
    if (db.tags.some((t) => tagNameKey(t.name) === tagNameKey(tag.name))) {
      return problem(409, 'Duplicate tag name')
    }
    db.tags.push(tag)
    return HttpResponse.json(tag, { status: 201 })
  }),

  http.patch(`${API_BASE}/tags/:id`, async ({ params, request }) => {
    const tag = db.tags.find((t) => t.id === params.id)
    if (!tag) return problem(404, 'Tag not found')
    const body = (await request.json()) as { name?: string; color?: string | null }
    const next: Tag = {
      ...tag,
      name: body.name !== undefined ? body.name.trim() : tag.name,
      color: body.color !== undefined ? body.color : tag.color,
    }
    const errors = validateTag(next)
    if (errors.length > 0) return problem(400, 'Validation failed', errors)
    if (db.tags.some((t) => t.id !== tag.id && tagNameKey(t.name) === tagNameKey(next.name))) {
      return problem(409, 'Duplicate tag name')
    }
    Object.assign(tag, next)
    return HttpResponse.json(tag)
  }),

  http.delete(`${API_BASE}/tags/:id`, ({ params }) => {
    db.tags = db.tags.filter((t) => t.id !== params.id)
    for (const task of db.tasks) {
      task.tagIds = task.tagIds.filter((id) => id !== params.id)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${API_BASE}/export`, () =>
    HttpResponse.json({ schemaVersion: 2, tasks: db.tasks, tags: db.tags }),
  ),

  http.post(`${API_BASE}/import`, async ({ request }) => {
    const body = (await request.json()) as AppData
    const { tasks, tags, errors } = validateImportData(body, tagIdSet())
    if (errors.length > 0) return problem(400, 'Validation failed', errors)
    let importedTasks = 0
    let importedTags = 0
    let skippedExisting = 0
    const tagNames = new Set(db.tags.map((t) => tagNameKey(t.name)))
    // Transactional: reject the whole import on a tag-name conflict before any write.
    for (const tag of tags) {
      if (db.tags.some((t) => t.id === tag.id)) continue
      const key = tagNameKey(tag.name)
      if (tagNames.has(key)) return problem(409, 'Duplicate tag name')
      tagNames.add(key)
    }
    for (const tag of tags) {
      if (db.tags.some((t) => t.id === tag.id)) skippedExisting++
      else {
        db.tags.push(tag)
        importedTags++
      }
    }
    for (const task of tasks) {
      if (db.tasks.some((t) => t.id === task.id)) skippedExisting++
      else {
        db.tasks.push(task)
        importedTasks++
      }
    }
    return HttpResponse.json({ importedTasks, importedTags, skippedExisting })
  }),
]
