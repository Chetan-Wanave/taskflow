import { sortByPosition } from '../domain/mutations'
import { isOverdue, todayLocal } from '../domain/dates'
import type { Tag, Task } from '../domain/types'

interface ViewState {
  tasks: Task[]
  tags: Tag[]
  filter: 'all' | 'active' | 'completed'
  search: string
  tagFilterId: string | null
}

export function selectVisibleTasks(state: ViewState): Task[] {
  const query = state.search.trim().toLowerCase()
  return sortByPosition(state.tasks).filter((task) => {
    if (state.filter === 'active' && task.completedAt !== null) return false
    if (state.filter === 'completed' && task.completedAt === null) return false
    if (state.tagFilterId !== null && !task.tagIds.includes(state.tagFilterId)) return false
    if (query.length > 0 && !matchesQuery(task, query)) return false
    return true
  })
}

/**
 * SPEC.md → Behaviour requirements → SRCH-1/SRCH-3: case-insensitive substring
 * over title OR notes; a task with null notes is matched on its title alone.
 */
function matchesQuery(task: Task, query: string): boolean {
  if (task.title.toLowerCase().includes(query)) return true
  return task.notes !== null && task.notes.toLowerCase().includes(query)
}

export interface Counts {
  all: number
  active: number
  completed: number
}

export function selectCounts(state: Pick<ViewState, 'tasks'>): Counts {
  let active = 0
  let completed = 0
  for (const task of state.tasks) {
    if (task.completedAt === null) active++
    else completed++
  }
  return { all: state.tasks.length, active, completed }
}

export function selectRemaining(state: Pick<ViewState, 'tasks'>): number {
  return state.tasks.filter((t) => t.completedAt === null).length
}

export function selectOverdueIds(state: Pick<ViewState, 'tasks'>): Set<string> {
  const today = todayLocal()
  const ids = new Set<string>()
  for (const task of state.tasks) {
    if (task.completedAt === null && task.dueDate !== null && isOverdue(task.dueDate, today)) {
      ids.add(task.id)
    }
  }
  return ids
}

export function selectTagUsage(state: Pick<ViewState, 'tasks'>): Map<string, number> {
  const usage = new Map<string, number>()
  for (const task of state.tasks) {
    for (const tagId of task.tagIds) {
      usage.set(tagId, (usage.get(tagId) ?? 0) + 1)
    }
  }
  return usage
}
