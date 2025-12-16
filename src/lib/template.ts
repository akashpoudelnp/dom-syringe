// Template parsing utilities

/**
 * Parse Markdown-style links to HTML
 * [text](url) -> <a href="url">text</a>
 */
export function parseTemplateToHtml(template: string): string {
  let html = template

  // Handle Markdown-style links: [text](url) -> <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>')

  return html
}

/**
 * Strip HTML tags for plain text, converting links to "text (url)" format
 */
export function stripHtmlToText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  // Convert links to "text (url)" format
  div.querySelectorAll('a').forEach((a) => {
    a.textContent = `${a.textContent} (${a.href})`
  })

  // Convert <br> to newlines
  div.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n')
  })

  return div.textContent || div.innerText || ''
}

/**
 * Replace variables in template with their values
 */
export function replaceVariables(
  template: string,
  values: Record<string, string>
): string {
  let result = template
  for (const [varName, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${varName}\\}`, 'g'), value)
  }
  return result
}

/**
 * Extract variable names from a template string
 */
export function extractVariableNames(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g) || []
  return matches.map((m) => m.slice(1, -1))
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

