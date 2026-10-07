import { IconMonitor, IconMoon, IconSun } from '../../components/icons'
import type { Theme } from '../../domain/types'
import { cx } from '../../lib/classnames'
import { useTheme } from './useTheme'
import styles from './ThemeToggle.module.css'

const OPTIONS: { value: Theme; label: string; icon: typeof IconSun }[] = [
  { value: 'light', label: 'Light theme', icon: IconSun },
  { value: 'system', label: 'System theme', icon: IconMonitor },
  { value: 'dark', label: 'Dark theme', icon: IconMoon },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className={styles.toggle} role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          className={cx(styles.option, theme === value && styles.active)}
          onClick={() => setTheme(value)}
        >
          <Icon width={13} height={13} />
        </button>
      ))}
    </div>
  )
}
