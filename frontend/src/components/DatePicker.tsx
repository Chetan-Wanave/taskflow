// Hand-built month-grid date picker — never a native <input type="date">.
// All values are 'YYYY-MM-DD' strings built from numeric parts.

import { useState } from 'react'
import { daysInMonth, dayOfWeek, monthCaption, toDateString, todayLocal } from '../domain/dates'
import { cx } from '../lib/classnames'
import { Button } from './Button'
import { IconChevronLeft, IconChevronRight } from './icons'
import styles from './DatePicker.module.css'

interface DatePickerProps {
  value: string | null
  onChange: (date: string | null) => void
}

const WEEKDAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function monthOf(date: string): { year: number; month: number } {
  const [y, m] = date.split('-').map(Number)
  return { year: y, month: m }
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const today = todayLocal()
  const [view, setView] = useState(() => monthOf(value ?? today))

  const shiftMonth = (delta: number) => {
    setView(({ year, month }) => {
      const next = month + delta
      if (next < 1) return { year: year - 1, month: 12 }
      if (next > 12) return { year: year + 1, month: 1 }
      return { year, month: next }
    })
  }

  const firstWeekday = dayOfWeek(toDateString(view.year, view.month, 1))
  const total = daysInMonth(view.year, view.month)
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ]

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.nav}
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          <IconChevronLeft />
        </button>
        <span className={styles.caption}>{monthCaption(view.year, view.month)}</span>
        <button
          type="button"
          className={styles.nav}
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          <IconChevronRight />
        </button>
      </div>
      <div className={styles.grid} role="grid">
        {WEEKDAY_HEADERS.map((day) => (
          <span key={day} className={styles.weekday}>
            {day}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`pad-${i}`} />
          const date = toDateString(view.year, view.month, day)
          return (
            <button
              key={date}
              type="button"
              className={cx(
                styles.day,
                date === today && styles.today,
                date === value && styles.selected,
              )}
              aria-pressed={date === value}
              onClick={() => onChange(date)}
            >
              {day}
            </button>
          )
        })}
      </div>
      <div className={styles.footer}>
        <Button variant="quiet" onClick={() => onChange(today)}>
          Today
        </Button>
        <Button variant="quiet" onClick={() => onChange(null)} disabled={value === null}>
          Clear
        </Button>
      </div>
    </div>
  )
}
