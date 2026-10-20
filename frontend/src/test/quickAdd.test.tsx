// Pinned because QuickAdd's tag picker shares components/Popover with the task
// edit popover and had the same latent focus-steal: with at least one existing
// tag, the first focusable control is a tag button, so typing in "New tag" lost
// focus after one character.

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppData, Tag } from '../domain/types'
import { QuickAdd } from '../features/tasks/QuickAdd'
import { STORAGE_KEY } from '../storage/migration'
import { useAppStore } from '../store/useAppStore'

const NOW = '2026-10-07T00:00:00.000Z'

function seed(tags: Tag[]): void {
  const envelope: AppData = { schemaVersion: 2, tasks: [], tags }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  useAppStore.setState({
    tasks: [],
    tags,
    filter: 'all',
    search: '',
    tagFilterId: null,
    selectedTaskId: null,
    editingTaskId: null,
    toasts: [],
    hydrated: true,
  })
}

describe('QuickAdd tag picker keeps focus while typing', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(cleanup)

  it('typing in the New tag input keeps focus and the full draft', async () => {
    seed([{ id: crypto.randomUUID(), name: 'work', color: null, createdAt: NOW }])
    render(<QuickAdd />)
    const user = userEvent.setup()

    await user.click(screen.getByPlaceholderText('Add a task…'))
    await user.click(screen.getByRole('button', { name: /Tags/ }))
    await screen.findByRole('dialog')

    const input = screen.getByPlaceholderText('New tag, press Enter')
    await user.click(input)
    await user.type(input, 'travel')
    expect(input).toHaveValue('travel')
    expect(document.activeElement).toBe(input)
  })
})
