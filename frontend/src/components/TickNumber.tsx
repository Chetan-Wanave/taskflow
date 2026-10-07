// Counter digits slide vertically when the value changes (160ms).

import { useEffect, useRef, useState } from 'react'
import styles from './TickNumber.module.css'

export function TickNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const [outgoing, setOutgoing] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (value === shown) return
    setOutgoing(shown)
    setShown(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOutgoing(null), 160)
    return () => window.clearTimeout(timer.current)
  }, [value, shown])

  return (
    <span className={styles.tick}>
      <span key={shown} className={outgoing !== null ? styles.in : undefined}>
        {shown}
      </span>
      {outgoing !== null && (
        <span key={`out-${outgoing}`} className={styles.out} aria-hidden>
          {outgoing}
        </span>
      )}
    </span>
  )
}
