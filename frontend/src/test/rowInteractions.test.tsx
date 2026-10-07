// Regression tests: dnd-kit's sortable listeners live on the whole <li>, so
// without an activator-node guard (KeyboardSensor) and a target filter
// (PointerSensor) any Enter/Space bubbling from the row's inputs/buttons was
// preventDefault-ed and started a drag — spaces could not be typed in the
// inline title editor and the checkbox could not be toggled by keyboard.

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppData, Task } from '../domain/types'
import { TaskList } from '../features/tasks/TaskList'
import { STORAGE_KEY } from '../storage/migration'
import { useAppStore } from '../store/useAppStore'

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
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
    createdAt: now,
    updatedAt: now,
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

describe('task row interactions are not hijacked by drag activation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(cleanup)

  it('typing spaces in the inline title editor inserts spaces', async () => {
    const task = makeTask({ title: 'Buy' })
    seed([task])
    useAppStore.setState({ editingTaskId: task.id })
    render(<TaskList />)
    const user = userEvent.setup()
    const input = screen.getByLabelText('Edit task title')
    await user.click(input)
    await user.type(input, ' milk')
    expect(input).toHaveValue('Buy milk')
  })

  it('Escape during inline title edit discards the change (Enter commits, Esc cancels)', async () => {
    const task = makeTask({ title: 'Original title' })
    seed([task])
    useAppStore.setState({ editingTaskId: task.id })
    render(<TaskList />)
    const user = userEvent.setup()
    const input = screen.getByLabelText('Edit task title')
    await user.click(input)
    await user.type(input, ' changed')
    expect(input).toHaveValue('Original title changed')
    // Escape restores row focus, which fires the input's blur while it is
    // still mounted — the blur handler must not commit the discarded draft.
    await user.keyboard('{Escape}')
    expect(useAppStore.getState().editingTaskId).toBeNull()
    expect(useAppStore.getState().tasks[0].title).toBe('Original title')
    // The persisted envelope must be untouched too (no optimistic write raced through).
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppData
      expect(stored.tasks[0].title).toBe('Original title')
    })
  })

  it('Enter during inline title edit commits the change', async () => {
    const task = makeTask({ title: 'Original title' })
    seed([task])
    useAppStore.setState({ editingTaskId: task.id })
    render(<TaskList />)
    const user = userEvent.setup()
    const input = screen.getByLabelText('Edit task title')
    await user.click(input)
    await user.type(input, ' changed{Enter}')
    await waitFor(() => {
      expect(useAppStore.getState().tasks[0].title).toBe('Original title changed')
    })
  })

  it('Enter on the row checkbox toggles completion instead of starting a drag', async () => {
    const task = makeTask({ title: 'Toggle me' })
    seed([task])
    render(<TaskList />)
    const user = userEvent.setup()
    const checkbox = screen.getByRole('checkbox')
    checkbox.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(useAppStore.getState().tasks[0].completedAt).not.toBeNull()
    })
    const row = document.querySelector('[data-task-id]')
    expect(row?.getAttribute('aria-pressed')).not.toBe('true')
  })
})
