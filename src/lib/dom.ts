// DOM utilities for element selection

/**
 * Get deep text content from an element
 */
export function getDeepText(element: Element | null): string {
  if (!element) return '[No Element]'

  // Get text content, trimmed
  const text = element.textContent?.trim()

  if (text && text.length > 0) {
    return text.length > 500 ? text.substring(0, 500) + '...' : text
  }

  // Check for value attribute (inputs, etc)
  if ((element as HTMLInputElement).value) {
    return (element as HTMLInputElement).value.trim()
  }

  // Check for alt text (images)
  if ((element as HTMLImageElement).alt) {
    return (element as HTMLImageElement).alt.trim()
  }

  // Check for title attribute
  if (element.getAttribute('title')) {
    return element.getAttribute('title')!.trim()
  }

  // Check for placeholder
  if ((element as HTMLInputElement).placeholder) {
    return `[Placeholder: ${(element as HTMLInputElement).placeholder}]`
  }

  return '[No Content]'
}

/**
 * Generate a CSS selector for an element
 */
export function generateSelector(element: Element): string {
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

    // Add nth-of-type if needed for uniqueness
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

/**
 * Get element value by selector
 */
export function getElementValue(selector: string): string {
  try {
    const element = document.querySelector(selector)
    return getDeepText(element)
  } catch {
    return '[Invalid Selector]'
  }
}

