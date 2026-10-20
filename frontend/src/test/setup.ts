import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Tests must never reach a real backend: frontend/.env may set VITE_STORAGE_MODE=api,
// and createAdapter() reads it when the store module loads (after this file runs).
vi.stubEnv('VITE_STORAGE_MODE', 'local')
