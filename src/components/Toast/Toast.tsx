import { clsx } from 'clsx'
import styles from './Toast.module.css'

interface ToastProps {
  message: string | null
  type: 'success' | 'error' | null
  onClose?: () => void
}

export function Toast({ message, type }: ToastProps) {
  if (!message || !type) return null

  return (
    <div className={clsx(styles.toast, styles[type], message && styles.show)}>
      <i className={`ti ti-${type === 'success' ? 'check' : 'x'}`} />
      {message}
    </div>
  )
}

