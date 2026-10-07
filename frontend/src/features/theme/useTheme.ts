import type { Theme } from '../../domain/types'
import { useAppStore } from '../../store/useAppStore'

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  return { theme, setTheme }
}
