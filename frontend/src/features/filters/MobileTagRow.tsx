// Mobile (<880px) companion to FilterTabs: the sidebar (and its tag filters)
// is hidden, so tags surface as a horizontally scrollable chip row under the
// tabs. Renders nothing when no tags exist; hidden on desktop via CSS.

import { TagChip } from '../../components/TagChip'
import { useAppStore } from '../../store/useAppStore'
import styles from './MobileTagRow.module.css'

export function MobileTagRow() {
  const tags = useAppStore((s) => s.tags)
  const tagFilterId = useAppStore((s) => s.tagFilterId)
  const setTagFilter = useAppStore((s) => s.setTagFilter)

  if (tags.length === 0) return null

  return (
    <div className={styles.row} role="group" aria-label="Tag filters">
      {tags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          active={tagFilterId === tag.id}
          onClick={() => setTagFilter(tagFilterId === tag.id ? null : tag.id)}
        />
      ))}
    </div>
  )
}
