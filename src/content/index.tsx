// DOM Syringe - Content Script

// Inline constants to avoid import issues
const STORAGE_KEYS = {
  PENDING_PICKER: 'pendingPicker',
  LAST_SELECTION: 'lastSelection',
} as const

// Types
interface LastSelection {
  variableName: string
  selector: string
  text: string
  tagName: string
  timestamp: number
}

interface MessageType {
  type: string
  variableName?: string
  selector?: string
}

let isPickerActive = false
let highlightedElement: Element | null = null
let currentVariableName: string | null = null
let pickerOverlay: HTMLElement | null = null

const originalStyles = new Map<Element, { outline: string; outlineOffset: string; backgroundColor: string }>()

// Inline DOM utilities
function getDeepText(element: Element | null): string {
  if (!element) return '[No Element]'

  const text = element.textContent?.trim()
  if (text && text.length > 0) {
    return text.length > 500 ? text.substring(0, 500) + '...' : text
  }

  if ((element as HTMLInputElement).value) {
    return (element as HTMLInputElement).value.trim()
  }

  if ((element as HTMLImageElement).alt) {
    return (element as HTMLImageElement).alt.trim()
  }

  if (element.getAttribute('title')) {
    return element.getAttribute('title')!.trim()
  }

  if ((element as HTMLInputElement).placeholder) {
    return `[Placeholder: ${(element as HTMLInputElement).placeholder}]`
  }

  return '[No Content]'
}

function generateSelector(element: Element): string {
  // Try ID first
  if (element.id) {
    return `#${CSS.escape(element.id)}`
  }

  // Try unique class combination
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter((c) => c)
    if (classes.length > 0) {
      const classSelector = '.' + classes.map((c) => CSS.escape(c)).join('.')
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector
      }
    }
  }

  // Build path from root
  const path: string[] = []
  let current: Element | null = element

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()

    if (current.id) {
      selector = `#${CSS.escape(current.id)}`
      path.unshift(selector)
      break
    }

    const parent: Element | null = current.parentElement
    if (parent) {
      const children = parent.children
      const siblings: Element[] = []
      for (let i = 0; i < children.length; i++) {
        if (children[i].tagName === current.tagName) {
          siblings.push(children[i])
        }
      }
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-of-type(${index})`
      }
    }

    path.unshift(selector)
    current = parent
  }

  return path.join(' > ')
}

function getElementValue(selector: string): string {
  try {
    const element = document.querySelector(selector)
    return getDeepText(element)
  } catch {
    return '[Invalid Selector]'
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  console.log('Content script received:', message.type)

  switch (message.type) {
    case 'PING':
      sendResponse({ success: true, loaded: true })
      break
    case 'START_PICKER':
      startPicker(message.variableName!)
      sendResponse({ success: true })
      break
    case 'STOP_PICKER':
      stopPicker(true)
      sendResponse({ success: true })
      break
    case 'CONFIRM_SELECTION':
      if (isPickerActive && highlightedElement) {
        confirmSelection(highlightedElement)
        sendResponse({ success: true })
      } else {
        sendResponse({ success: false })
      }
      break
    case 'GET_ELEMENT_VALUE':
      const value = getElementValue(message.selector!)
      console.log('GET_ELEMENT_VALUE:', message.selector, '->', value)
      sendResponse({ value })
      break
    case 'GET_PAGE_INFO':
      sendResponse({ url: window.location.href, title: document.title })
      break
  }
  return true
})

function startPicker(variableName: string) {
  if (isPickerActive) {
    currentVariableName = variableName
    updateOverlay()
    return
  }

  isPickerActive = true
  currentVariableName = variableName
  createOverlay()

  document.addEventListener('mousemove', handleMouseMove, true)
  document.addEventListener('click', handleClick, true)
  document.addEventListener('keydown', handleKeyDown, true)

  chrome.storage.local.set({
    [STORAGE_KEYS.PENDING_PICKER]: {
      active: true,
      variableName,
      timestamp: Date.now(),
    },
  })
}

function stopPicker(cancelled = false) {
  if (!isPickerActive) return

  isPickerActive = false
  currentVariableName = null
  removeOverlay()
  removeHighlight()

  document.removeEventListener('mousemove', handleMouseMove, true)
  document.removeEventListener('click', handleClick, true)
  document.removeEventListener('keydown', handleKeyDown, true)

  chrome.storage.local.remove(STORAGE_KEYS.PENDING_PICKER)

  if (cancelled) {
    chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' })
  }
}

function createOverlay() {
  // Inject styles if not already present
  if (!document.getElementById('dom-syringe-styles')) {
    const style = document.createElement('style')
    style.id = 'dom-syringe-styles'
    style.textContent = `
      #dom-syringe-picker-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2147483647;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: ds-slide-down 0.2s ease-out;
      }
      .ds-picker-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 12px 20px;
        background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
        color: white;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
      }
      .ds-picker-header svg { flex-shrink: 0; }
      .ds-picker-title { font-weight: 500; }
      .ds-picker-title strong { color: #FDE68A; }
      .ds-picker-hint {
        opacity: 0.85;
        font-size: 12px;
        padding-left: 12px;
        border-left: 1px solid rgba(255, 255, 255, 0.3);
      }
      .ds-picker-hint strong {
        background: rgba(255,255,255,0.2);
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }
      @keyframes ds-slide-down {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `
    document.head.appendChild(style)
  }

  pickerOverlay = document.createElement('div')
  pickerOverlay.id = 'dom-syringe-picker-overlay'

  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const confirmKey = isMac ? '⌘⇧E' : 'Ctrl+Shift+E'

  pickerOverlay.innerHTML = `
    <div class="ds-picker-header">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 2l4 4-2.5 2.5L17 6l-2.5 2.5L6 17l-4 4"/>
        <path d="M9.5 9.5L3 16"/>
      </svg>
      <span class="ds-picker-title">Selecting: <strong>${currentVariableName || 'element'}</strong></span>
      <span class="ds-picker-hint">Hover & press <strong>${confirmKey}</strong> to select · <strong>Esc</strong> to cancel</span>
    </div>
  `
  document.body.appendChild(pickerOverlay)
}

function updateOverlay() {
  if (pickerOverlay) {
    const strong = pickerOverlay.querySelector('.ds-picker-title strong')
    if (strong) strong.textContent = currentVariableName || 'element'
  }
}

function removeOverlay() {
  pickerOverlay?.remove()
  pickerOverlay = null
}

function handleMouseMove(e: MouseEvent) {
  if (!isPickerActive) return

  const element = e.target as Element
  if (element.closest('#dom-syringe-picker-overlay')) return

  removeHighlight()
  highlightElement(element)
}

function handleClick(e: MouseEvent) {
  if (!isPickerActive) return

  const element = e.target as Element
  if (element.closest('#dom-syringe-picker-overlay')) return

  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isPickerActive) return

  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    stopPicker(true)
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault()
    e.stopPropagation()
    if (highlightedElement) {
      confirmSelection(highlightedElement)
    }
  }
}

function confirmSelection(element: Element) {
  const selector = generateSelector(element)
  const text = getDeepText(element)

  console.log('DOM Syringe: Confirming selection')
  console.log('  Selector:', selector)
  console.log('  Text:', text.substring(0, 100))
  console.log('  Variable:', currentVariableName)

  const selection: LastSelection = {
    variableName: currentVariableName!,
    selector,
    text,
    tagName: element.tagName.toLowerCase(),
    timestamp: Date.now(),
  }

  chrome.storage.local.set({ [STORAGE_KEYS.LAST_SELECTION]: selection })

  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    ...selection,
  }).then(() => {
    console.log('DOM Syringe: Message sent successfully')
  }).catch((err) => {
    console.error('DOM Syringe: Failed to send message', err)
  })

  stopPicker(false)
}

function highlightElement(element: Element) {
  const el = element as HTMLElement
  originalStyles.set(element, {
    outline: el.style.outline,
    outlineOffset: el.style.outlineOffset,
    backgroundColor: el.style.backgroundColor,
  })

  el.style.outline = '2px solid #4F46E5'
  el.style.outlineOffset = '2px'
  el.style.backgroundColor = 'rgba(79, 70, 229, 0.1)'

  highlightedElement = element
}

function removeHighlight() {
  if (highlightedElement && originalStyles.has(highlightedElement)) {
    const el = highlightedElement as HTMLElement
    const original = originalStyles.get(highlightedElement)!
    el.style.outline = original.outline
    el.style.outlineOffset = original.outlineOffset
    el.style.backgroundColor = original.backgroundColor
    originalStyles.delete(highlightedElement)
  }
  highlightedElement = null
}

