// The signature checkbox: priority-tinted 18px box, stroke-draw check,
// spring pop and ring bloom on check; unchecking reverses instantly.

import { useState } from 'react'
import type { Priority } from '../../domain/types'
import { cx } from '../../lib/classnames'
import styles from './Checkbox.module.css'

interface CheckboxProps {
  checked: boolean
  priority: Priority
  label: string
  onToggle: () => void
}

const PRIORITY_CLASS: Record<Priority, string> = {
  NONE: 'pNone',
  LOW: 'pLow',
  MEDIUM: 'pMed',
  HIGH: 'pHigh',
}

export function Checkbox({ checked, priority, label, onToggle }: CheckboxProps) {
  // Ceremony only for checks performed in this mount — not when a row renders
  // already completed (filter switches, boot).
  const [celebrate, setCelebrate] = useState(false)

  const handleClick = () => {
    setCelebrate(!checked)
    onToggle()
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Mark "${label}" as active` : `Complete "${label}"`}
      className={cx(
        styles.box,
        styles[PRIORITY_CLASS[priority]],
        checked && styles.checked,
        checked && celebrate && styles.celebrate,
      )}
      onClick={handleClick}
    >
      <span className={styles.ring} aria-hidden />
      <svg className={styles.mark} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          className={styles.path}
          d="M3.8 8.4 6.7 11.2 12.2 4.9"
          pathLength={24}
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
