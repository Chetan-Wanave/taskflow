import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { IconButton } from '../components/IconButton'
import { IconDownload, IconSearch, IconUpload, IconX } from '../components/icons'
import { TickNumber } from '../components/TickNumber'
import { headerDate } from '../domain/dates'
import { initKeyboard } from '../lib/keyboard'
import { selectCounts } from '../store/selectors'
import { useAppStore } from '../store/useAppStore'
import { FilterTabs } from '../features/filters/FilterTabs'
import { MobileTagRow } from '../features/filters/MobileTagRow'
import { Sidebar } from '../features/filters/Sidebar'
import { useImportExport } from '../features/filters/useImportExport'
import { QuickAdd } from '../features/tasks/QuickAdd'
import { TaskList } from '../features/tasks/TaskList'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { ToastHost } from './ToastHost'
import styles from './App.module.css'

const SEARCH_DEBOUNCE_MS = 200

function SearchBox() {
  const search = useAppStore((s) => s.search)
  const setSearch = useAppStore((s) => s.setSearch)
  const [draft, setDraft] = useState(search)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced client-side text search (view state only, never persisted).
  useEffect(() => {
    if (draft === search) return
    const timer = window.setTimeout(() => setSearch(draft), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [draft, search, setSearch])

  // External clears (Escape shortcut, "Clear search" button) reset the draft.
  useEffect(() => {
    setDraft(search)
  }, [search])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      setDraft('')
      setSearch('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className={styles.search}>
      <IconSearch className={styles.searchIcon} />
      <input
        ref={inputRef}
        data-search-input
        className={styles.searchInput}
        value={draft}
        placeholder="Search"
        aria-label="Search tasks"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {draft.length > 0 && (
        <button
          type="button"
          className={styles.searchClear}
          aria-label="Clear search"
          onClick={() => {
            setDraft('')
            setSearch('')
          }}
        >
          <IconX width={12} height={12} />
        </button>
      )}
    </div>
  )
}

// Mobile (<880px): the sidebar is hidden, so theme, export, and import get
// compact icon affordances in the header row. Hidden on desktop via CSS.
function MobileActions() {
  const { fileInputRef, exportJson, onImportFile, openImportPicker } = useImportExport()

  return (
    <div className={styles.mobileActions}>
      <IconButton label="Export tasks as JSON" onClick={() => void exportJson()}>
        <IconDownload width={14} height={14} />
      </IconButton>
      <IconButton label="Import Taskflow JSON" onClick={openImportPicker}>
        <IconUpload width={14} height={14} />
      </IconButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className={styles.fileInput}
        aria-label="Import Taskflow JSON"
        onChange={(e) => void onImportFile(e)}
      />
      <ThemeToggle />
    </div>
  )
}

function Footer() {
  const tasks = useAppStore((s) => s.tasks)
  const clearCompleted = useAppStore((s) => s.clearCompleted)
  const counts = selectCounts({ tasks })

  if (tasks.length === 0) return null

  return (
    <footer className={styles.footer}>
      <span className={styles.remaining} aria-live="polite">
        <TickNumber value={counts.active} /> {counts.active === 1 ? 'task' : 'tasks'} left
      </span>
      {counts.completed > 0 && (
        <button
          type="button"
          className={styles.clearCompleted}
          onClick={() => void clearCompleted()}
        >
          Clear completed
        </button>
      )}
    </footer>
  )
}

export function App() {
  const hydrated = useAppStore((s) => s.hydrated)
  const bootError = useAppStore((s) => s.bootError)
  const boot = useAppStore((s) => s.boot)

  useEffect(() => {
    void boot()
    return initKeyboard()
  }, [boot])

  if (!hydrated) {
    return <div className={styles.app} aria-busy="true" />
  }

  return (
    <div className={styles.app}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.column}>
          <header className={styles.header}>
            <h1 className={styles.title}>{headerDate()}</h1>
            <MobileActions />
            <SearchBox />
          </header>
          <FilterTabs />
          <MobileTagRow />
          {bootError ? (
            <p className={styles.bootError} role="alert">
              {bootError}
            </p>
          ) : (
            <>
              <QuickAdd />
              <section className={styles.listSection} aria-label="Task list">
                <TaskList />
              </section>
              <Footer />
            </>
          )}
        </div>
      </main>
      <ToastHost />
    </div>
  )
}
