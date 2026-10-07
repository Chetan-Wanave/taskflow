import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../lib/classnames'
import styles from './Button.module.css'

type Variant = 'primary' | 'quiet' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'quiet', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(styles.button, styles[variant], className)} {...rest} />
}
