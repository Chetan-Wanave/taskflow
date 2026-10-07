// Single keymap: N new · / search · ArrowUp/Down navigate · E edit · D toggle
// done · Backspace delete · 0/1/2/3 priority · Alt+Arrow reorder · Escape clear.

import { PRIORITY_BY_DIGIT } from '../domain/priority'
import { selectVisibleTasks } from '../store/selectors'
import { useAppStore } from '../store/useAppStore'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function focusRow(taskId: string): void {
  document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`)?.focus()
}

function moveSelection(delta: -1 | 1): void {
  const state = useAppStore.getState()
  const visible = selectVisibleTasks(state)
  if (visible.length === 0) return
  const currentIndex = visible.findIndex((t) => t.id === state.selectedTaskId)
  const nextIndex =
    currentIndex === -1
      ? delta === 1
        ? 0
        : visible.length - 1
      : Math.min(visible.length - 1, Math.max(0, currentIndex + delta))
  const next = visible[nextIndex]
  state.selectTask(next.id)
  focusRow(next.id)
}

export function initKeyboard(): () => void {
  const handler = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey) return

    const state = useAppStore.getState()
    const target = event.target as HTMLElement | null

    // Popovers own their keyboard handling entirely.
    if (target instanceof HTMLElement && target.closest('[role="dialog"]')) return

    if (event.key === 'Escape') {
      if (isTypingTarget(target)) return // inputs handle their own Escape
      if (state.editingTaskId !== null) {
        state.setEditingTask(null)
      } else if (state.search.length > 0) {
        state.setSearch('')
      } else if (state.tagFilterId !== null) {
        state.setTagFilter(null)
      } else {
        state.selectTask(null)
      }
      return
    }

    if (isTypingTarget(target)) return

    // A row mid keyboard-drag (dnd-kit sets aria-pressed) owns the arrows.
    const dragging =
      target instanceof HTMLElement &&
      target.closest('[data-task-id]')?.getAttribute('aria-pressed') === 'true'

    switch (event.key) {
      case 'n':
      case 'N':
        event.preventDefault()
        document.querySelector<HTMLElement>('[data-quickadd-input]')?.focus()
        return
      case '/':
        event.preventDefault()
        document.querySelector<HTMLElement>('[data-search-input]')?.focus()
        return
      case 'ArrowDown':
      case 'ArrowUp': {
        if (dragging) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        event.preventDefault()
        if (event.altKey) {
          if (state.selectedTaskId !== null) {
            const id = state.selectedTaskId
            void state.moveTaskBy(id, delta).then(() => focusRow(id))
          }
        } else {
          moveSelection(delta)
        }
        return
      }
      default:
        break
    }

    const selectedId = state.selectedTaskId
    if (selectedId === null || event.altKey) return

    switch (event.key) {
      case 'e':
      case 'E': {
        const task = state.tasks.find((t) => t.id === selectedId)
        if (task && task.completedAt === null) {
          event.preventDefault()
          state.setEditingTask(selectedId)
        }
        return
      }
      case 'd':
      case 'D':
        event.preventDefault()
        void state.toggleTask(selectedId)
        return
      case 'Backspace':
      case 'Delete':
        event.preventDefault()
        void state.removeTask(selectedId)
        return
      case '0':
      case '1':
      case '2':
      case '3':
        event.preventDefault()
        void state.patchTask(selectedId, { priority: PRIORITY_BY_DIGIT[event.key] })
        return
      default:
        return
    }
  }

  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}
