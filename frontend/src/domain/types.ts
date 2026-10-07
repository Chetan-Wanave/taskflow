export type Priority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'

export interface Task {
  id: string // UUIDv4, client-generated (crypto.randomUUID())
  title: string // 1..500 after trim
  notes: string | null // <= 10000
  priority: Priority // default 'NONE'
  dueDate: string | null // 'YYYY-MM-DD', date-only, NEVER a Date object
  completedAt: string | null // ISO-8601 UTC ms; null = active
  position: number // sparse gap 1024; integer > 0
  parentId: string | null // always null in v1 UI (subtask-ready)
  tagIds: string[]
  createdAt: string // ISO-8601 UTC ms
  updatedAt: string
}

export interface Tag {
  id: string
  name: string // 1..50, unique per user case-insensitive
  color: string | null // '#RRGGBB' or null (default neutral chip)
  createdAt: string
}

export interface AppData {
  schemaVersion: 2
  tasks: Task[]
  tags: Tag[]
}

export type Filter = 'all' | 'active' | 'completed'
export type Theme = 'light' | 'dark' | 'system'

export function isDone(task: Task): boolean {
  return task.completedAt !== null
}

export function emptyAppData(): AppData {
  return { schemaVersion: 2, tasks: [], tags: [] }
}
