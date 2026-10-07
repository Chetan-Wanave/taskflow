// Mobile (<880px) replacement for the sidebar filter nav.

import type { Filter } from '../../domain/types'
import { cx } from '../../lib/classnames'
import { selectCounts } from '../../store/selectors'
import { useAppStore } from '../../store/useAppStore'
import styles from './FilterTabs.module.css'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
]

export function FilterTabs() {
  const tasks = useAppStore((s) => s.tasks)
  const filter = useAppStore((s) => s.filter)
  const setFilter = useAppStore((s) => s.setFilter)
  const counts = selectCounts({ tasks })

  return (
    <div className={styles.tabs} role="radiogroup" aria-label="Filters">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={filter === key}
          className={cx(styles.tab, filter === key && styles.active)}
          onClick={() => setFilter(key)}
        >
          {label}
          <span className={styles.count}>{counts[key]}</span>
        </button>
      ))}
    </div>
  )
}
