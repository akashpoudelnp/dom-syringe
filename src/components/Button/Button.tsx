import { clsx } from 'clsx'
import styles from './Button.module.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  children?: React.ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(styles.button, styles[variant], styles[size], className)}
      {...props}
    >
      {icon && <i className={`ti ti-${icon}`} />}
      {children}
    </button>
  )
}

