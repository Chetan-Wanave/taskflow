// The single crafted editing surface: priority, due date, tags, notes.

import { useState } from 'react'
import { DatePicker } from '../../components/DatePicker'
import { IconFlag } from '../../components/icons'
import { Popover } from '../../components/Popover'
import { dueLabel } from '../../domain/dates'
import { PRIORITIES, PRIORITY_LABEL } from '../../domain/priority'
import type { Priority, Task } from '../../domain/types'
import { cx } from '../../lib/classnames'
import { useAppStore } from '../../store/useAppStore'
import styles from './TaskEditPopover.module.css'

interface TaskEditPopoverProps {
  task: Task
  anchor: HTMLElement | null
  open: boolean
  onClose: () => void
}

const PRIORITY_CLASS: Record<Priority, string> = {
  NONE: 'flagNone',
  LOW: 'flagLow',
  MEDIUM: 'flagMed',
  HIGH: 'flagHigh',
}

export function TaskEditPopover({ task, anchor, open, onClose }: TaskEditPopoverProps) {
  const tags = useAppStore((s) => s.tags)
  const patchTask = useAppStore((s) => s.patchTask)
  const addTag = useAppStore((s) => s.addTag)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const commitNotes = () => {
    if (notesDraft === null) return
    const value = notesDraft.trim().length === 0 ? null : notesDraft
    if (value !== task.notes) void patchTask(task.id, { notes: value })
    setNotesDraft(null)
  }

  const close = () => {
    commitNotes()
    setShowDatePicker(false)
    onClose()
  }

  const toggleTag = (tagId: string) => {
    const tagIds = task.tagIds.includes(tagId)
      ? task.tagIds.filter((id) => id !== tagId)
      : [...task.tagIds, tagId]
    void patchTask(task.id, { tagIds })
  }

  const createTag = async () => {
    const name = newTag.trim()
    if (name.length === 0) return
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    const tag = existing ?? (await addTag(name, null))
    if (tag) {
      setNewTag('')
      if (!task.tagIds.includes(tag.id)) {
        void patchTask(task.id, { tagIds: [...task.tagIds, tag.id] })
      }
    }
  }

  const due = task.dueDate ? dueLabel(task.dueDate) : null

  return (
    <Popover anchor={anchor} open={open} onClose={close} width={320}>
      <div className={styles.section}>
        <span className={styles.sectionLabel} id={`prio-label-${task.id}`}>
          Priority
        </span>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-labelledby={`prio-label-${task.id}`}
        >
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              role="radio"
              aria-checked={task.priority === priority}
              className={cx(
                styles.segment,
                styles[PRIORITY_CLASS[priority]],
                task.priority === priority && styles.segmentActive,
              )}
              onClick={() => void patchTask(task.id, { priority })}
              data-autofocus={priority === task.priority ? true : undefined}
            >
              <IconFlag width={13} height={13} />
              {PRIORITY_LABEL[priority]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Due date</span>
        <div className={styles.dueRow}>
          <button
            type="button"
            className={styles.dueValue}
            onClick={() => setShowDatePicker((v) => !v)}
            aria-expanded={showDatePicker}
          >
            {due ? (
              <span className={cx(styles.dueText, styles[due.tone])}>{due.text}</span>
            ) : (
              <span className={styles.duePlaceholder}>No due date</span>
            )}
          </button>
          {task.dueDate !== null && (
            <button
              type="button"
              className={styles.dueClear}
              onClick={() => void patchTask(task.id, { dueDate: null })}
            >
              Clear
            </button>
          )}
        </div>
        {showDatePicker && (
          <DatePicker
            value={task.dueDate}
            onChange={(date) => {
              void patchTask(task.id, { dueDate: date })
              setShowDatePicker(false)
            }}
          />
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Tags</span>
        {tags.length > 0 && (
          <div className={styles.tagList}>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={cx(styles.tagOption, task.tagIds.includes(tag.id) && styles.tagOn)}
                aria-pressed={task.tagIds.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        )}
        <input
          className={styles.tagInput}
          value={newTag}
          maxLength={50}
          placeholder="Add a tag and press Enter"
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void createTag()
            }
          }}
        />
      </div>

      <div className={styles.section}>
        <label className={styles.sectionLabel} htmlFor={`notes-${task.id}`}>
          Notes
        </label>
        <textarea
          id={`notes-${task.id}`}
          className={styles.notes}
          rows={3}
          maxLength={10000}
          placeholder="Add notes…"
          value={notesDraft ?? task.notes ?? ''}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={commitNotes}
        />
      </div>
    </Popover>
  )
}
