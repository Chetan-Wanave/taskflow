import { IconDownload, IconTag, IconUpload, IconX } from '../../components/icons'
import type { Filter } from '../../domain/types'
import { cx } from '../../lib/classnames'
import { selectCounts, selectTagUsage } from '../../store/selectors'
import { useAppStore } from '../../store/useAppStore'
import { ThemeToggle } from '../theme/ThemeToggle'
import { useImportExport } from './useImportExport'
import styles from './Sidebar.module.css'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
]

export function Sidebar() {
  const tasks = useAppStore((s) => s.tasks)
  const tags = useAppStore((s) => s.tags)
  const filter = useAppStore((s) => s.filter)
  const tagFilterId = useAppStore((s) => s.tagFilterId)
  const setFilter = useAppStore((s) => s.setFilter)
  const setTagFilter = useAppStore((s) => s.setTagFilter)
  const removeTag = useAppStore((s) => s.removeTag)

  const { fileInputRef, exportJson, onImportFile, openImportPicker } = useImportExport()
  const counts = selectCounts({ tasks })
  const usage = selectTagUsage({ tasks })

  return (
    <aside className={styles.sidebar}>
      <div className={styles.wordmark}>taskflow</div>

      <nav className={styles.nav} aria-label="Filters">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={cx(styles.navItem, filter === key && styles.navActive)}
            aria-current={filter === key ? 'page' : undefined}
            onClick={() => setFilter(key)}
          >
            <span>{label}</span>
            <span className={styles.pill}>{counts[key]}</span>
          </button>
        ))}
      </nav>

      <div className={styles.tagsSection}>
        <div className={styles.sectionTitle}>Tags</div>
        {tags.length === 0 ? (
          <p className={styles.tagsEmpty}>Tag tasks from the edit popover.</p>
        ) : (
          <div className={styles.tagList}>
            {tags.map((tag) => (
              <div key={tag.id} className={styles.tagRow}>
                <button
                  type="button"
                  className={cx(styles.tagButton, tagFilterId === tag.id && styles.tagActive)}
                  aria-pressed={tagFilterId === tag.id}
                  onClick={() => setTagFilter(tagFilterId === tag.id ? null : tag.id)}
                >
                  <IconTag width={13} height={13} />
                  <span className={styles.tagName}>{tag.name}</span>
                  <span className={styles.pill}>{usage.get(tag.id) ?? 0}</span>
                </button>
                <button
                  type="button"
                  className={styles.tagDelete}
                  aria-label={`Delete tag ${tag.name}`}
                  title={`Delete tag ${tag.name}`}
                  onClick={() => void removeTag(tag.id)}
                >
                  <IconX width={12} height={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.footerButton} onClick={() => void exportJson()}>
          <IconDownload width={13} height={13} />
          Export
        </button>
        <button type="button" className={styles.footerButton} onClick={openImportPicker}>
          <IconUpload width={13} height={13} />
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className={styles.fileInput}
          aria-label="Import Taskflow JSON"
          onChange={(e) => void onImportFile(e)}
        />
        <div className={styles.themeSlot}>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
