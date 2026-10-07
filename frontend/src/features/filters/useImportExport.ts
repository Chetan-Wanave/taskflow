// Export/import of the schemaVersion-2 envelope, shared by the desktop
// sidebar footer and the mobile header actions (the sidebar is hidden <880px).

import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import type { AppData } from '../../domain/types'
import { adapter, useAppStore } from '../../store/useAppStore'

function isEnvelope(value: unknown): value is AppData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as AppData).schemaVersion === 2 &&
    Array.isArray((value as AppData).tasks) &&
    Array.isArray((value as AppData).tags)
  )
}

export function useImportExport() {
  const importEnvelope = useAppStore((s) => s.importEnvelope)
  const pushToast = useAppStore((s) => s.pushToast)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportJson = async () => {
    try {
      const data = await adapter.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'taskflow-export.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      pushToast({ message: 'Export failed', kind: 'error' })
    }
  }

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isEnvelope(parsed)) {
        pushToast({ message: 'Not a Taskflow export (schemaVersion 2 expected)', kind: 'error' })
        return
      }
      await importEnvelope(parsed)
    } catch {
      pushToast({ message: 'Could not read that file as JSON', kind: 'error' })
    }
  }

  const openImportPicker = () => fileInputRef.current?.click()

  return { fileInputRef, exportJson, onImportFile, openImportPicker }
}
