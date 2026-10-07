// Regression: Popover's initial-focus effect was keyed on onClose, whose
// identity changes on every consumer render; each keystroke in Notes re-ran it
// and moved focus to the Priority button, so only one character could be typed
// (bug report 2026-10-07). Pinned so the popover never moves focus on re-render.

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppData, Task } from '../domain/types'
import { TaskList } from '../features/tasks/TaskList'
import { STORAGE_KEY } from '../storage/migration'
import { useAppStore } from '../store/useAppStore'

const NOW = '2026-10-07T00:00:00.000Z'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: 'Buy',
    notes: null,
    priority: 'NONE',
    dueDate: null,
    completedAt: null,
    position: 1024,
    parentId: null,
    tagIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function seed(tasks: Task[]): void {
  const envelope: AppData = { schemaVersion: 2, tasks, tags: [] }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  useAppStore.setState({
    tasks,
    tags: [],
    filter: 'all',
    search: '',
    tagFilterId: null,
    selectedTaskId: null,
    editingTaskId: null,
    toasts: [],
    hydrated: true,
  })
}

describe('task edit popover keeps focus while typing', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(cleanup)

  it('typing several characters in Notes keeps focus and the full draft', async () => {
    const task = makeTask({ title: 'Buy', priority: 'MEDIUM' })
    seed([task])
    render(<TaskList />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit task (E to rename)' }))
    await screen.findByRole('dialog')
    // Initial focus lands on the selected priority — must survive the fix.
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Medium' }))

    const notes = screen.getByLabelText('Notes')
    await user.click(notes)
    await user.type(notes, 'Call the venue')
    expect(notes).toHaveValue('Call the venue')
    expect(document.activeElement).toBe(notes)
  })
})
