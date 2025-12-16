import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <i className="ti ti-vaccine" />
        <h1>DOM Syringe</h1>
      </div>
    </header>
  )
}

