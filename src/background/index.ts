// DOM Syringe - Background Service Worker
import type { CopyItem } from '../lib/types'

const STORAGE_KEY = 'copyItems'
const MENU_PARENT_ID = 'dom-syringe-parent'

let menuBuilding = false

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('DOM Syringe installed')
  buildContextMenu()
})

chrome.runtime.onStartup.addListener(() => {
  buildContextMenu()
})

// Rebuild menu when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[STORAGE_KEY]) {
    buildContextMenu()
  }
})

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  if (command === 'confirm-selection') {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'CONFIRM_SELECTION' })
    } catch (e) {
      console.log('Could not send confirm selection:', e)
    }
  }
})

// Build context menu
async function buildContextMenu() {
  if (menuBuilding) return
  menuBuilding = true

  try {
    await chrome.contextMenus.removeAll()

    chrome.contextMenus.create({
      id: MENU_PARENT_ID,
      title: 'DOM Syringe',
      contexts: ['page', 'selection'],
    })

    const result = await chrome.storage.sync.get(STORAGE_KEY)
    const copyItems = (result[STORAGE_KEY] as CopyItem[]) || []

    if (copyItems.length === 0) {
      chrome.contextMenus.create({
        id: 'no-items',
        parentId: MENU_PARENT_ID,
        title: '(No copy items yet)',
        enabled: false,
        contexts: ['page', 'selection'],
      })
    } else {
      copyItems.forEach((item, index) => {
        chrome.contextMenus.create({
          id: `copy-item-${index}`,
          parentId: MENU_PARENT_ID,
          title: item.name || 'Untitled',
          contexts: ['page', 'selection'],
        })
      })
    }
  } catch (error) {
    console.error('Failed to build context menu:', error)
  } finally {
    menuBuilding = false
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.menuItemId.toString().startsWith('copy-item-')) return
  if (!tab?.id) return

  const index = parseInt(info.menuItemId.toString().replace('copy-item-', ''))
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  const copyItems = (result[STORAGE_KEY] as CopyItem[]) || []
  const item = copyItems[index]

  if (!item) return

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractAndCopy,
      args: [item],
    })
  } catch (error) {
    console.error('Failed to extract and copy:', error)
  }
})

// Function injected into page
function extractAndCopy(copyItem: CopyItem) {
  function getDeepText(element: Element | null): string {
    if (!element) return '[No Element]'
    const text = element.textContent?.trim()
    if (text && text.length > 0) return text
    if ((element as HTMLInputElement).value) return (element as HTMLInputElement).value.trim()
    if ((element as HTMLImageElement).alt) return (element as HTMLImageElement).alt.trim()
    if (element.getAttribute('title')) return element.getAttribute('title')!.trim()
    return '[No Content]'
  }

  function parseToHtml(tmpl: string): string {
    let html = tmpl
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    html = html.replace(/\n/g, '<br>')
    return html
  }

  function stripTags(html: string): string {
    const div = document.createElement('div')
    div.innerHTML = html
    // For links, just keep the text, remove the URL entirely
    div.querySelectorAll('a').forEach((a) => {
      const text = document.createTextNode(a.textContent || '')
      a.replaceWith(text)
    })
    div.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
    return div.textContent || div.innerText || ''
  }

  function showFeedback() {
    const el = document.createElement('div')
    el.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: white;
      padding: 14px 20px;
      border-radius: 10px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3), 0 0 20px rgba(16, 185, 129, 0.3);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: dsSlideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    `
    el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied to clipboard'

    const style = document.createElement('style')
    style.textContent = `@keyframes dsSlideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`
    document.head.appendChild(style)
    document.body.appendChild(el)

    setTimeout(() => {
      el.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      el.style.opacity = '0'
      el.style.transform = 'translateX(100px)'
      setTimeout(() => { el.remove(); style.remove() }, 250)
    }, 2000)
  }

  const { template, variables } = copyItem
  const values: Record<string, string> = {}

  for (const [varName, selector] of Object.entries(variables || {})) {
    try {
      const element = document.querySelector(selector)
      values[varName] = getDeepText(element)
    } catch {
      values[varName] = '[Invalid Selector]'
    }
  }

  values['CURRENT_PAGE_URL'] = window.location.href
  values['CURRENT_PAGE_TITLE'] = document.title

  let result = template
  for (const [varName, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${varName}\\}`, 'g'), value)
  }

  const html = parseToHtml(result)
  const plainText = stripTags(html)

  navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
    }),
  ]).then(showFeedback).catch(() => {
    navigator.clipboard.writeText(plainText).then(showFeedback)
  })
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REBUILD_MENU') {
    buildContextMenu()
    sendResponse({ success: true })
  }
  return true
})

