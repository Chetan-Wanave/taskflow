// 5-second undo stack for delete and clear-completed. Deleted rows are held in
// the toast closure; undo replays createTask with the original id + position,
// which is idempotent thanks to client-generated UUIDs.

import type { Task } from '../domain/types'
import { useAppStore } from './useAppStore'

export const UNDO_WINDOW_MS = 5000

export function registerUndo(deleted: Task[], message: string): void {
  const store = useAppStore.getState()
  const rows = deleted.map((t) => ({ ...t, tagIds: [...t.tagIds] }))
  store.pushToast(
    {
      message,
      kind: 'info',
      actionLabel: 'Undo',
      onAction: () => {
        void useAppStore.getState().restoreTasks(rows)
      },
    },
    UNDO_WINDOW_MS,
  )
}
