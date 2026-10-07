// Plain capture input; a second row (priority segmented control, due picker,
// tag picker) is revealed only while the composer is focused or holds a draft.

import { useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { DatePicker } from '../../components/DatePicker'
import { IconCalendar, IconFlag, IconPlus, IconTag, IconX } from '../../components/icons'
import { Popover } from '../../components/Popover'
import { dueLabel } from '../../domain/dates'
import { PRIORITIES, PRIORITY_LABEL } from '../../domain/priority'
import type { Priority } from '../../domain/types'
import { validateTitle } from '../../domain/validation'
import { cx } from '../../lib/classnames'
import { useAppStore } from '../../store/useAppStore'
import styles from './QuickAdd.module.css'

const PRIORITY_CLASS: Record<Priority, string> = {
  NONE: 'flagNone',
  LOW: 'flagLow',
  MEDIUM: 'flagMed',
  HIGH: 'flagHigh',
}

export function QuickAdd() {
  const tags = useAppStore((s) => s.tags)
  const addTask = useAppStore((s) => s.addTask)
  const addTag = useAppStore((s) => s.addTag)
  const pushToast = useAppStore((s) => s.pushToast)

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('NONE')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const [duePickerOpen, setDuePickerOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const dueButtonRef = useRef<HTMLButtonElement>(null)
  const tagButtonRef = useRef<HTMLButtonElement>(null)

  const hasDraft =
    title.trim().length > 0 || priority !== 'NONE' || dueDate !== null || tagIds.length > 0
  const expanded = focused || duePickerOpen || tagPickerOpen || hasDraft

  const submit = async () => {
    const errors = validateTitle(title)
    if (title.trim().length === 0) return
    if (errors.length > 0) {
      pushToast({ message: `Title ${errors[0].message}`, kind: 'error' })
      return
    }
    const ok = await addTask({ title, priority, dueDate, tagIds })
    if (ok) {
      setTitle('')
      setPriority('NONE')
      setDueDate(null)
      setTagIds([])
      inputRef.current?.focus()
    }
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (event.nativeEvent.isComposing) return // IME confirm, not a submit
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape') {
      event.stopPropagation()
      inputRef.current?.blur()
    }
  }

  const onBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
  }

  const toggleTag = (id: string) => {
    setTagIds((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    )
  }

  const createTag = async () => {
    const name = newTagName.trim()
    if (name.length === 0) return
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    const tag = existing ?? (await addTag(name, null))
    if (tag) {
      setNewTagName('')
      if (!tagIds.includes(tag.id)) setTagIds((current) => [...current, tag.id])
    }
  }

  const due = dueDate ? dueLabel(dueDate) : null

  return (
    <div
      className={cx(styles.composer, expanded && styles.expanded)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={onBlurCapture}
    >
      <div className={styles.inputRow}>
        <IconPlus className={styles.plus} />
        <input
          ref={inputRef}
          data-quickadd-input
          className={styles.input}
          value={title}
          maxLength={500}
          placeholder="Add a task…"
          aria-label="Add a task"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={onInputKeyDown}
        />
      </div>
      {expanded && (
        <div className={styles.optionsRow}>
          <div className={styles.segmented} role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                title={`Priority: ${PRIORITY_LABEL[p]}`}
                className={cx(
                  styles.segment,
                  styles[PRIORITY_CLASS[p]],
                  priority === p && styles.segmentActive,
                )}
                onClick={() => setPriority(p)}
              >
                <IconFlag width={12} height={12} />
                <span className={styles.segmentText}>{PRIORITY_LABEL[p]}</span>
              </button>
            ))}
          </div>

          <button
            ref={dueButtonRef}
            type="button"
            className={cx(styles.option, due && styles.optionSet, due?.tone === 'overdue' && styles.optionOverdue)}
            aria-expanded={duePickerOpen}
            onClick={() => setDuePickerOpen((v) => !v)}
          >
            <IconCalendar width={13} height={13} />
            {due ? due.text : 'Due'}
          </button>

          <button
            ref={tagButtonRef}
            type="button"
            className={cx(styles.option, tagIds.length > 0 && styles.optionSet)}
            aria-expanded={tagPickerOpen}
            onClick={() => setTagPickerOpen((v) => !v)}
          >
            <IconTag width={13} height={13} />
            {tagIds.length > 0 ? `${tagIds.length} tag${tagIds.length > 1 ? 's' : ''}` : 'Tags'}
          </button>

          {hasDraft && (
            <button
              type="button"
              className={styles.reset}
              aria-label="Reset draft"
              onClick={() => {
                setTitle('')
                setPriority('NONE')
                setDueDate(null)
                setTagIds([])
              }}
            >
              <IconX width={13} height={13} />
            </button>
          )}
        </div>
      )}

      <Popover
        anchor={dueButtonRef.current}
        open={duePickerOpen}
        onClose={() => setDuePickerOpen(false)}
        width={264}
      >
        <DatePicker
          value={dueDate}
          onChange={(date) => {
            setDueDate(date)
            setDuePickerOpen(false)
            inputRef.current?.focus()
          }}
        />
      </Popover>

      <Popover
        anchor={tagButtonRef.current}
        open={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        width={240}
      >
        <div className={styles.tagPicker}>
          {tags.length > 0 && (
            <div className={styles.tagList}>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={cx(styles.tagOption, tagIds.includes(tag.id) && styles.tagOn)}
                  aria-pressed={tagIds.includes(tag.id)}
                  onClick={() => toggleTag(tag.id)}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          )}
          <input
            className={styles.tagInput}
            value={newTagName}
            maxLength={50}
            placeholder="New tag, press Enter"
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void createTag()
              }
            }}
          />
        </div>
      </Popover>
    </div>
  )
}
