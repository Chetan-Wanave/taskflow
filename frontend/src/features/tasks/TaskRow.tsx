import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { IconButton } from '../../components/IconButton'
import { IconPencil, IconTrash } from '../../components/icons'
import { TagChip } from '../../components/TagChip'
import { dueLabel } from '../../domain/dates'
import { PRIORITY_LABEL } from '../../domain/priority'
import type { Task } from '../../domain/types'
import { cx } from '../../lib/classnames'
import { useAppStore } from '../../store/useAppStore'
import { Checkbox } from './Checkbox'
import { TaskEditPopover } from './TaskEditPopover'
import styles from './TaskRow.module.css'

interface TaskRowProps {
  task: Task
  isTabStop: boolean
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function TaskRow({ task, isTabStop }: TaskRowProps) {
  const tags = useAppStore((s) => s.tags)
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const editingTaskId = useAppStore((s) => s.editingTaskId)
  const tagFilterId = useAppStore((s) => s.tagFilterId)
  const selectTask = useAppStore((s) => s.selectTask)
  const setEditingTask = useAppStore((s) => s.setEditingTask)
  const setTagFilter = useAppStore((s) => s.setTagFilter)
  const toggleTask = useAppStore((s) => s.toggleTask)
  const patchTask = useAppStore((s) => s.patchTask)
  const removeTask = useAppStore((s) => s.removeTask)

  const rowRef = useRef<HTMLLIElement | null>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  // Escape must discard the edit, but restoring focus to the row fires the
  // input's blur synchronously while the input is still mounted — so the flag
  // is set BEFORE any focus change and the blur handler honors it (same
  // cancelled-flag pattern as the legacy app).
  const editCancelledRef = useRef(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  // Drag activation must never hijack the row's interactive children (checkbox,
  // action buttons, the inline edit input, or the portaled popover — portal
  // events bubble through the React tree back to this <li>). The KeyboardSensor
  // only ignores bubbled Enter/Space when an activator node is registered (see
  // setActivatorNodeRef on the <li> below); the PointerSensor has no such guard,
  // so filter its activation by event target here.
  const onRowPointerDown = (event: ReactPointerEvent<HTMLLIElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button, input, textarea, select, a, [role="dialog"]')) return
    listeners?.onPointerDown?.(event)
  }

  const done = task.completedAt !== null
  const selected = selectedTaskId === task.id
  const editing = editingTaskId === task.id
  const due = task.dueDate ? dueLabel(task.dueDate) : null
  const rowTags = task.tagIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t) => t !== undefined)

  const beginDelete = () => {
    const el = rowRef.current
    if (leaving) return
    if (!el || reducedMotion()) {
      void removeTask(task.id)
      return
    }
    el.style.height = `${el.offsetHeight}px`
    requestAnimationFrame(() => setLeaving(true))
    window.setTimeout(() => void removeTask(task.id), 360)
  }

  const commitTitle = (value: string) => {
    const title = value.trim()
    setEditingTask(null)
    if (title.length > 0 && title !== task.title) {
      void patchTask(task.id, { title })
    }
  }

  const onEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (event.nativeEvent.isComposing) return // IME confirm, not a commit
      commitTitle(event.currentTarget.value)
    } else if (event.key === 'Escape') {
      event.stopPropagation()
      editCancelledRef.current = true // before focus() — its blur must not commit
      setEditingTask(null)
      rowRef.current?.focus()
    }
  }

  return (
    <li
      ref={(node) => {
        rowRef.current = node
        setNodeRef(node)
        setActivatorNodeRef(node)
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cx(
        styles.row,
        done && styles.done,
        selected && styles.selected,
        isDragging && styles.dragging,
        leaving && styles.leaving,
      )}
      data-task-id={task.id}
      onFocus={(e) => {
        if (e.target === rowRef.current) selectTask(task.id)
      }}
      {...attributes}
      tabIndex={isTabStop ? 0 : -1}
      aria-label={`${task.title}${done ? ', completed' : ''}${task.priority !== 'NONE' ? `, priority ${PRIORITY_LABEL[task.priority]}` : ''}`}
      {...listeners}
      onPointerDown={onRowPointerDown}
    >
      <Checkbox
        checked={done}
        priority={task.priority}
        label={task.title}
        onToggle={() => void toggleTask(task.id)}
      />
      <div className={styles.content}>
        {editing ? (
          <input
            ref={(node) => {
              // Fresh edit session — clear any cancel left by a previous Escape.
              if (node) editCancelledRef.current = false
            }}
            className={styles.labelEdit}
            defaultValue={task.title}
            maxLength={500}
            autoFocus
            onKeyDown={onEditKeyDown}
            onBlur={(e) => {
              if (editCancelledRef.current) return
              commitTitle(e.currentTarget.value)
            }}
            aria-label="Edit task title"
          />
        ) : (
          <span
            className={cx(styles.label, done && styles.labelDone)}
            onDoubleClick={() => {
              if (!done) setEditingTask(task.id)
            }}
            title={task.priority !== 'NONE' ? `Priority: ${PRIORITY_LABEL[task.priority]}` : undefined}
          >
            {task.title}
          </span>
        )}
        {(due || rowTags.length > 0 || task.notes) && !editing && (
          <span className={styles.meta}>
            {due && <span className={cx(styles.due, styles[due.tone])}>{due.text}</span>}
            {task.notes && (
              <span className={styles.notesHint} title={task.notes}>
                notes
              </span>
            )}
            {rowTags.map((tag) => (
              <TagChip
                key={tag.id}
                tag={tag}
                active={tagFilterId === tag.id}
                onClick={() => setTagFilter(tagFilterId === tag.id ? null : tag.id)}
              />
            ))}
          </span>
        )}
      </div>
      <span className={styles.actions}>
        <IconButton
          ref={editButtonRef}
          label="Edit task (E to rename)"
          onClick={() => setPopoverOpen(true)}
        >
          <IconPencil />
        </IconButton>
        <IconButton label="Delete task" tone="danger" onClick={beginDelete}>
          <IconTrash />
        </IconButton>
      </span>
      <TaskEditPopover
        task={task}
        anchor={editButtonRef.current}
        open={popoverOpen}
        onClose={() => setPopoverOpen(false)}
      />
    </li>
  )
}
