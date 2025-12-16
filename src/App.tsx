import { useEffect } from 'react'
import { useStore } from '@/hooks'
import { Header, Toast } from '@/components'
import { ListView, EditorView } from '@/pages'
import { getCurrentTab, canAccessTab } from '@/lib'
import './styles/globals.css'
import styles from './App.module.css'

export function App() {
  const {
    view,
    loadCopyItems,
    checkPendingSelection,
    setPageInfo,
    toastMessage,
    toastType,
  } = useStore()

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    await loadCopyItems()
    await checkPendingSelection()

    // Get current page info
    const tab = await getCurrentTab()
    if (tab && canAccessTab(tab)) {
      setPageInfo({
        url: tab.url || '',
        title: tab.title || '',
      })
    }
  }

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        {view === 'list' ? <ListView /> : <EditorView />}
      </main>
      <Toast message={toastMessage} type={toastType} />
    </div>
  )
}

