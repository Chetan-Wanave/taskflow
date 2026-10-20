// Regression: Popover's initial-focus effect was keyed on onClose, whose
// identity changes on every consumer render; each keystroke in Notes re-ran it
// and moved focus to the Priority button, so only one character could be typed
// (bug report 2026-10-07). Pinned so the popover never moves focus on re-render.

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

async function openPopover(task: Task) {
  seed([task])
  render(<TaskList />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Edit task (E to rename)' }))
  await screen.findByRole('dialog')
  return user
}

function spyOnPatchTask() {
  const real = useAppStore.getState().patchTask
  const spy = vi.fn(real)
  useAppStore.setState({ patchTask: spy })
  return { spy, restore: () => useAppStore.setState({ patchTask: real }) }
}

describe('task edit popover keeps focus while typing', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

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

  // Browsers refuse .focus() on visibility:hidden elements; jsdom does not, so
  // record the computed visibility at call time instead of trusting activeElement.
  it('initial focus is applied while the panel is visible', async () => {
    const task = makeTask({ title: 'Buy', priority: 'MEDIUM' })
    seed([task])
    const calls: { text: string; visibility: string }[] = []
    const realFocus = HTMLElement.prototype.focus
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, ...args) {
      calls.push({ text: this.textContent ?? '', visibility: getComputedStyle(this.closest('[role="dialog"]') ?? this).visibility })
      return realFocus.apply(this, args)
    })
    render(<TaskList />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit task (E to rename)' }))
    await screen.findByRole('dialog')
    const medium = screen.getByRole('radio', { name: 'Medium' })
    const inDialog = calls.filter((c) => c.text.includes('Medium'))
    expect(inDialog.length).toBeGreaterThan(0)
    expect(inDialog.every((c) => c.visibility === 'visible')).toBe(true)
    expect(document.activeElement).toBe(medium)
  })

  it('typing in the Add-a-tag input keeps focus and the full draft', async () => {
    const task = makeTask({ title: 'Buy' })
    const user = await openPopover(task)
    const input = screen.getByPlaceholderText('Add a tag and press Enter')
    await user.click(input)
    await user.type(input, 'travel')
    expect(input).toHaveValue('travel')
    expect(document.activeElement).toBe(input)

    await user.keyboard('{Enter}')
    await waitFor(() => {
      const { tags, tasks } = useAppStore.getState()
      expect(tags.map((t) => t.name)).toEqual(['travel'])
      expect(tasks[0].tagIds).toEqual([tags[0].id])
    })
    expect(input).toHaveValue('')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Tab from the Notes textarea wraps to the first priority button', async () => {
    const user = await openPopover(makeTask())
    await user.click(screen.getByLabelText('Notes'))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'None' }))
  })

  it('Shift+Tab from the first priority button wraps to the Notes textarea', async () => {
    const user = await openPopover(makeTask())
    screen.getByRole('radio', { name: 'None' }).focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByLabelText('Notes'))
  })

  it('Escape commits the Notes draft, closes the popover, and returns focus to the Edit button', async () => {
    const user = await openPopover(makeTask())
    const notes = screen.getByLabelText('Notes')
    await user.click(notes)
    await user.type(notes, 'Bring ID')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(useAppStore.getState().tasks[0].notes).toBe('Bring ID'))
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppData
    expect(envelope.tasks[0].notes).toBe('Bring ID')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Edit task (E to rename)' }),
    )
  })

  it('blurring the Notes textarea commits the draft without closing the popover', async () => {
    const { spy, restore } = spyOnPatchTask()
    try {
      const user = await openPopover(makeTask())
      const notes = screen.getByLabelText('Notes')
      await user.click(notes)
      await user.type(notes, '  ')
      await user.tab()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(useAppStore.getState().tasks[0].notes).toBeNull()
      expect(spy).not.toHaveBeenCalled()

      await user.click(notes)
      await user.type(notes, 'Keep')
      await user.tab()
      await waitFor(() => expect(useAppStore.getState().tasks[0].notes).toBe('Keep'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
