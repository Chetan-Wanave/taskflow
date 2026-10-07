import { IconX } from '../components/icons'
import { useAppStore } from '../store/useAppStore'
import styles from './ToastHost.module.css'

export function ToastHost() {
  const toasts = useAppStore((s) => s.toasts)
  const dismissToast = useAppStore((s) => s.dismissToast)

  return (
    <div className={styles.host} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={toast.kind === 'error' ? styles.toastError : styles.toast}
          role="status"
        >
          <span className={styles.message}>{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.onAction?.()
                dismissToast(toast.id)
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            className={styles.close}
            aria-label="Dismiss"
            onClick={() => dismissToast(toast.id)}
          >
            <IconX width={12} height={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
