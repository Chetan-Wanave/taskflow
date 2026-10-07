import { ApiAdapter } from './ApiAdapter'
import { LocalStorageAdapter } from './LocalStorageAdapter'
import type { StorageAdapter } from './StorageAdapter'

export function createAdapter(): StorageAdapter {
  const mode = import.meta.env.VITE_STORAGE_MODE ?? 'local'
  if (mode === 'api') {
    return new ApiAdapter(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1')
  }
  return new LocalStorageAdapter()
}
