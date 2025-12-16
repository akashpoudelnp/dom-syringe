import { useEffect } from 'react'
import { useStore } from '@/hooks'
import { Header, Toast } from '@/components'
import { ListView, EditorView } from '@/pages'
import { getCurrentTab, canAccessTab } from '@/lib'
import type { LastSelection } from '@/lib'
import './styles/globals.css'
import styles from './App.module.css'

export function App() {
  const {
    view,
    loadCopyItems,
    checkPendingSelection,
    setPageInfo,
    handleSelection,
    toastMessage,
    toastType,
  } = useStore()

  useEffect(() => {
    init()

    // Listen for messages from content script
    const messageListener = (
      message: { type: string } & Partial<LastSelection>,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      console.log('App received message:', message.type)

      if (message.type === 'ELEMENT_SELECTED') {
        console.log('Processing selection:', {
          variableName: message.variableName,
          selector: message.selector,
          text: message.text?.substring(0, 50),
        })

        handleSelection({
          variableName: message.variableName!,
          selector: message.selector!,
          text: message.text!,
          tagName: message.tagName!,
          timestamp: Date.now(),
        })

        sendResponse({ received: true })
      }

      return true // Keep channel open for async response
    }

    chrome.runtime.onMessage.addListener(messageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [handleSelection])

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

