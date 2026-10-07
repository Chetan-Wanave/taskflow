import type { ButtonHTMLAttributes, Ref } from 'react'
import { cx } from '../lib/classnames'
import styles from './IconButton.module.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger'
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ label, tone = 'default', className, type = 'button', ref, ...rest }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, tone === 'danger' && styles.danger, className)}
      {...rest}
    />
  )
}
