import { create } from 'zustand'
import { applyTaskPatch, buildTask, sortByPosition } from '../domain/mutations'
import type { NewTaskInput } from '../domain/mutations'
import { midpoint, needsRenormalize, renormalize } from '../domain/position'
import type { AppData, Filter, Tag, Task, Theme } from '../domain/types'
import { applyThemeAttribute, loadStoredTheme, persistTheme } from '../features/theme/themeDom'
import { createAdapter } from '../storage/createAdapter'
import { RepositoryError, supportsExternalChanges } from '../storage/StorageAdapter'
import type { TaskPatch } from '../storage/StorageAdapter'
import { registerUndo } from './undo'
import { selectVisibleTasks } from './selectors'

export const adapter = createAdapter()

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'error'
  actionLabel?: string
  onAction?: () => void
}

export interface AppState {
  tasks: Task[]
  tags: Tag[]
  filter: Filter
  search: string
  tagFilterId: string | null
  selectedTaskId: string | null
  editingTaskId: string | null
  theme: Theme
  toasts: Toast[]
  hydrated: boolean
  bootError: string | null

  boot: () => Promise<void>
  reload: () => Promise<void>
  addTask: (input: NewTaskInput) => Promise<boolean>
  patchTask: (id: string, patch: TaskPatch) => Promise<boolean>
  toggleTask: (id: string) => Promise<boolean>
  removeTask: (id: string) => Promise<void>
  clearCompleted: () => Promise<void>
  restoreTasks: (tasks: Task[]) => Promise<void>
  moveTask: (activeId: string, overId: string) => Promise<void>
  moveTaskBy: (id: string, delta: -1 | 1) => Promise<void>
  addTag: (name: string, color: string | null) => Promise<Tag | null>
  removeTag: (id: string) => Promise<void>
  importEnvelope: (data: AppData) => Promise<boolean>

  setFilter: (filter: Filter) => void
  setSearch: (search: string) => void
  setTagFilter: (tagId: string | null) => void
  selectTask: (id: string | null) => void
  setEditingTask: (id: string | null) => void
  setTheme: (theme: Theme) => void
  pushToast: (toast: Omit<Toast, 'id'>, durationMs?: number) => number
  dismissToast: (id: number) => void
}

let nextToastId = 1
// boot() is memoized: StrictMode mounts effects twice in dev, and a second run
// would double-subscribe the multi-tab 'storage' listener.
let bootPromise: Promise<void> | null = null

function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) {
    if (error.kind === 'validation' && error.fieldErrors?.length) {
      return `${error.fieldErrors[0].field} ${error.fieldErrors[0].message}`
    }
    return error.message
  }
  return 'Something went wrong'
}

export const useAppStore = create<AppState>()((set, get) => {
  const pushError = (error: unknown): void => {
    get().pushToast({ message: errorMessage(error), kind: 'error' })
  }

  return {
    tasks: [],
    tags: [],
    filter: 'all',
    search: '',
    tagFilterId: null,
    selectedTaskId: null,
    editingTaskId: null,
    theme: loadStoredTheme(),
    toasts: [],
    hydrated: false,
    bootError: null,

    boot: () => {
      bootPromise ??= (async () => {
        try {
          await adapter.init()
          const data = await adapter.load()
          set({ tasks: data.tasks, tags: data.tags, hydrated: true })
          if (supportsExternalChanges(adapter)) {
            adapter.subscribeExternalChanges(() => {
              void get().reload()
            })
          }
        } catch (error) {
          set({ hydrated: true, bootError: errorMessage(error) })
        }
      })()
      return bootPromise
    },

    reload: async () => {
      try {
        const data = await adapter.load()
        set({ tasks: data.tasks, tags: data.tags })
      } catch (error) {
        pushError(error)
      }
    },

    addTask: async (input) => {
      const now = new Date().toISOString()
      const task = buildTask(input, get().tasks.map((t) => t.position), now)
      set((s) => ({ tasks: [...s.tasks, task] }))
      try {
        const saved = await adapter.createTask(task)
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === task.id ? saved : t)) }))
        return true
      } catch (error) {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== task.id) }))
        pushError(error)
        return false
      }
    },

    patchTask: async (id, patch) => {
      const snapshot = get().tasks.find((t) => t.id === id)
      if (!snapshot) return false
      const optimistic = applyTaskPatch(snapshot, patch, new Date().toISOString())
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? optimistic : t)) }))
      try {
        const saved = await adapter.updateTask(id, patch)
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? saved : t)) }))
        return true
      } catch (error) {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? snapshot : t)) }))
        pushError(error)
        return false
      }
    },

    toggleTask: async (id) => {
      const task = get().tasks.find((t) => t.id === id)
      if (!task) return false
      return get().patchTask(id, { completed: task.completedAt === null })
    },

    removeTask: async (id) => {
      const snapshot = get().tasks.find((t) => t.id === id)
      if (!snapshot) return
      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        selectedTaskId: s.selectedTaskId === id ? null : s.selectedTaskId,
        editingTaskId: s.editingTaskId === id ? null : s.editingTaskId,
      }))
      try {
        await adapter.deleteTask(id)
        registerUndo([snapshot], 'Task deleted')
      } catch (error) {
        set((s) => ({ tasks: [...s.tasks, snapshot] }))
        pushError(error)
      }
    },

    clearCompleted: async () => {
      const snapshot = get().tasks.filter((t) => t.completedAt !== null)
      if (snapshot.length === 0) return
      set((s) => ({ tasks: s.tasks.filter((t) => t.completedAt === null) }))
      try {
        await adapter.clearCompleted()
        registerUndo(
          snapshot,
          snapshot.length === 1 ? '1 completed task cleared' : `${snapshot.length} completed tasks cleared`,
        )
      } catch (error) {
        set((s) => ({ tasks: [...s.tasks, ...snapshot] }))
        pushError(error)
      }
    },

    restoreTasks: async (tasks) => {
      set((s) => ({
        tasks: [...s.tasks, ...tasks.filter((r) => !s.tasks.some((t) => t.id === r.id))],
      }))
      for (const task of tasks) {
        try {
          const saved = await adapter.createTask(task)
          // Adopt the persisted row (in API mode completedAt is re-stamped
          // server-side) so the store never drifts from the adapter.
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === saved.id ? saved : t)) }))
        } catch (error) {
          // Conflict = the row already exists (undo replay is idempotent).
          if (!(error instanceof RepositoryError && error.kind === 'conflict')) {
            set((s) => ({ tasks: s.tasks.filter((t) => t.id !== task.id) }))
            pushError(error)
          }
        }
      }
    },

    moveTask: async (activeId, overId) => {
      if (activeId === overId) return
      const state = get()
      const visible = selectVisibleTasks(state)
      const from = visible.findIndex((t) => t.id === activeId)
      const to = visible.findIndex((t) => t.id === overId)
      if (from === -1 || to === -1) return

      const reordered = [...visible]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(to, 0, moved)
      const index = reordered.findIndex((t) => t.id === activeId)
      const prev = index > 0 ? reordered[index - 1].position : null
      const next = index < reordered.length - 1 ? reordered[index + 1].position : null

      const snapshot = state.tasks
      if (needsRenormalize(prev, next)) {
        const batch = renormalize(reordered.map((t) => t.id))
        const byId = new Map(batch.map((p) => [p.id, p.position]))
        set((s) => ({
          tasks: s.tasks.map((t) => (byId.has(t.id) ? { ...t, position: byId.get(t.id) as number } : t)),
        }))
        try {
          await adapter.reorderTasks(batch)
        } catch (error) {
          set({ tasks: snapshot })
          pushError(error)
        }
      } else {
        const position = midpoint(prev, next)
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === activeId ? { ...t, position } : t)) }))
        try {
          await adapter.updateTask(activeId, { position })
        } catch (error) {
          set({ tasks: snapshot })
          pushError(error)
        }
      }
    },

    moveTaskBy: async (id, delta) => {
      const visible = selectVisibleTasks(get())
      const from = visible.findIndex((t) => t.id === id)
      const to = from + delta
      if (from === -1 || to < 0 || to >= visible.length) return
      await get().moveTask(id, visible[to].id)
    },

    addTag: async (name, color) => {
      const tag: Tag = {
        id: crypto.randomUUID(),
        name: name.trim(),
        color,
        createdAt: new Date().toISOString(),
      }
      set((s) => ({ tags: [...s.tags, tag] }))
      try {
        const saved = await adapter.createTag(tag)
        set((s) => ({ tags: s.tags.map((t) => (t.id === tag.id ? saved : t)) }))
        return saved
      } catch (error) {
        set((s) => ({ tags: s.tags.filter((t) => t.id !== tag.id) }))
        pushError(error)
        return null
      }
    },

    removeTag: async (id) => {
      const snapshotTags = get().tags
      const snapshotTasks = get().tasks
      set((s) => ({
        tags: s.tags.filter((t) => t.id !== id),
        tasks: s.tasks.map((t) =>
          t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((tagId) => tagId !== id) } : t,
        ),
        tagFilterId: s.tagFilterId === id ? null : s.tagFilterId,
      }))
      try {
        await adapter.deleteTag(id)
      } catch (error) {
        set({ tags: snapshotTags, tasks: snapshotTasks })
        pushError(error)
      }
    },

    importEnvelope: async (data) => {
      try {
        await adapter.importData(data)
        await get().reload()
        get().pushToast({ message: 'Import complete', kind: 'info' })
        return true
      } catch (error) {
        pushError(error)
        return false
      }
    },

    setFilter: (filter) => set({ filter }),
    setSearch: (search) => set({ search }),
    setTagFilter: (tagFilterId) => set({ tagFilterId }),
    selectTask: (selectedTaskId) => set({ selectedTaskId }),
    setEditingTask: (editingTaskId) => set({ editingTaskId }),

    setTheme: (theme) => {
      persistTheme(theme)
      applyThemeAttribute(theme)
      set({ theme })
    },

    pushToast: (toast, durationMs = 5000) => {
      const id = nextToastId++
      set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
      window.setTimeout(() => get().dismissToast(id), durationMs)
      return id
    },

    dismissToast: (id) => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    },
  }
})

export function sortedTasks(tasks: readonly Task[]): Task[] {
  return sortByPosition(tasks)
}
