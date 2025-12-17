import styles from './Header.module.css'

export function Header() {
    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <img className={styles.logoIcon} src={'/icons/icon128.png'} alt="DOM Syringe Logo"/>
                <div className={styles.logoText}>
                    <h1>DOM Syringe</h1>
                    <span className={styles.version}>v0.3.0</span>
                </div>
            </div>
        </header>
    )
}

