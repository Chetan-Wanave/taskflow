import type { Tag } from '../domain/types'
import { cx } from '../lib/classnames'
import styles from './TagChip.module.css'

interface TagChipProps {
  tag: Tag
  active?: boolean
  onClick?: () => void
}

export function TagChip({ tag, active = false, onClick }: TagChipProps) {
  const label = `#${tag.name}`
  if (!onClick) {
    return <span className={styles.chip}>{label}</span>
  }
  return (
    <button
      type="button"
      className={cx(styles.chip, styles.clickable, active && styles.active)}
      onClick={onClick}
      aria-pressed={active}
      title={active ? `Stop filtering by ${label}` : `Filter by ${label}`}
    >
      {label}
    </button>
  )
}
