import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '@/hooks'
import { Button } from '@/components'
import {
  getCurrentTab,
  canAccessTab,
  ensureContentScript,
  sendToContent,
  BUILT_IN_VARIABLES
} from '@/lib'
import styles from './EditorView.module.css'

export function EditorView() {
  const {
    currentItem,
    editingIndex,
    pageInfo,
    setView,
    saveItem,
    deleteItem,
    addVariable,
    updateVariable,
    removeVariable,
    updateTemplate,
    updateItemName,
    saveEditingState,
    showToast,
  } = useStore()

  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load variable values from page
  useEffect(() => {
    loadVariableValues()
  }, [JSON.stringify(currentItem?.variables)])

  const loadVariableValues = async () => {
    if (!currentItem) return

    const tab = await getCurrentTab()
    if (!tab?.id || !canAccessTab(tab)) return

    const values: Record<string, string> = {}

    for (const [name, selector] of Object.entries(currentItem.variables)) {
      if (selector) {
        try {
          const response = await sendToContent<{ value: string }>(tab.id, {
            type: 'GET_ELEMENT_VALUE',
            selector,
          })
          values[name] = response?.value || '[No value]'
        } catch {
          values[name] = '[Error]'
        }
      }
    }

    setVariableValues(values)
  }

  const handleAddVariable = async () => {
    const tab = await getCurrentTab()

    if (!tab?.id) {
      showToast('No active tab found', 'error')
      return
    }

    if (!canAccessTab(tab)) {
      showToast('Cannot use picker on this page', 'error')
      return
    }

    const varName = `var${Object.keys(currentItem?.variables || {}).length + 1}`

    // Save state before starting picker
    await saveEditingState()

    // Ensure content script is loaded
    const loaded = await ensureContentScript(tab.id)
    if (!loaded) {
      showToast('Could not start picker. Try refreshing the page.', 'error')
      return
    }

    // Start picker
    await sendToContent(tab.id, { type: 'START_PICKER', variableName: varName })
    addVariable(varName, '')
  }

  const handleRepick = async (varName: string) => {
    const tab = await getCurrentTab()
    if (!tab?.id || !canAccessTab(tab)) {
      showToast('Cannot use picker on this page', 'error')
      return
    }

    await saveEditingState()
    await ensureContentScript(tab.id)
    await sendToContent(tab.id, { type: 'START_PICKER', variableName: varName })
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateTemplate(e.target.value)
    checkForSuggestions(e.target)
  }

  const checkForSuggestions = (textarea: HTMLTextAreaElement) => {
    const cursorPos = textarea.selectionStart
    const text = textarea.value

    let startPos = cursorPos - 1
    while (startPos >= 0 && text[startPos] !== '{' && text[startPos] !== '}' && text[startPos] !== '\n') {
      startPos--
    }

    if (startPos >= 0 && text[startPos] === '{') {
      const partial = text.substring(startPos + 1, cursorPos)
      if (!partial.includes('}')) {
        const allVars = [
          ...BUILT_IN_VARIABLES,
          ...Object.keys(currentItem?.variables || {}),
        ]
        const filtered = allVars.filter((v) =>
          v.toLowerCase().includes(partial.toLowerCase())
        )

        if (filtered.length > 0) {
          setSuggestions(filtered)
          setSuggestionIndex(0)
          setShowSuggestions(true)
          return
        }
      }
    }

    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestionIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (suggestions[suggestionIndex]) {
        e.preventDefault()
        insertSuggestion(suggestions[suggestionIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const insertSuggestion = (varName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const text = textarea.value

    let startPos = cursorPos - 1
    while (startPos >= 0 && text[startPos] !== '{') {
      startPos--
    }

    const before = text.substring(0, startPos)
    const after = text.substring(cursorPos)
    const newText = `${before}{${varName}}${after}`

    updateTemplate(newText)

    const newCursorPos = startPos + varName.length + 2
    setTimeout(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    }, 0)

    setShowSuggestions(false)
  }

  const handleSave = async () => {
    if (!currentItem?.name.trim()) {
      showToast('Please enter a name', 'error')
      return
    }
    await saveItem()
    showToast('Saved successfully', 'success')
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem()
      showToast('Deleted successfully', 'success')
    }
  }

  if (!currentItem) return null

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => setView('list')}>
          Back
        </Button>
        <h2>{editingIndex >= 0 ? 'Edit' : 'New'} Copy Item</h2>
      </div>

      <div className={styles.form}>
        {/* Name Input */}
        <div className={styles.field}>
          <label>Name</label>
          <input
            type="text"
            value={currentItem.name}
            onChange={(e) => updateItemName(e.target.value)}
            placeholder="e.g., Blog Summary"
          />
        </div>

        {/* Variables */}
        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <label>Variables</label>
            <Button variant="ghost" size="sm" icon="plus" onClick={handleAddVariable}>
              Add
            </Button>
          </div>

          {Object.keys(currentItem.variables).length === 0 ? (
            <div className={styles.emptyVars}>
              Click "Add" to pick elements from the page
            </div>
          ) : (
            <div className={styles.varList}>
              {Object.entries(currentItem.variables).map(([name, selector]) => (
                <div key={name} className={styles.varItem}>
                  <div className={styles.varName}>
                    <span>{'{'}</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateVariable(name, e.target.value)}
                    />
                    <span>{'}'}</span>
                  </div>
                  <div className={styles.varValue}>
                    {variableValues[name] || (selector ? 'Loading...' : 'Not set')}
                  </div>
                  <div className={styles.varActions}>
                    <button onClick={() => handleRepick(name)} title="Re-pick">
                      <i className="ti ti-focus-2" />
                    </button>
                    <button onClick={() => removeVariable(name)} title="Delete">
                      <i className="ti ti-x" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Template Editor */}
        <div className={styles.field}>
          <label>Template</label>
          <div className={styles.helpText}>
            Use <code>{'{varName}'}</code> for variables, <code>[text](url)</code> for links
          </div>
          <div className={styles.editorWrapper}>
            <textarea
              ref={textareaRef}
              value={currentItem.template}
              onChange={handleTemplateChange}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={`Example:\n{title}\n\n{description}\n\n[Read More]({CURRENT_PAGE_URL})`}
              rows={6}
            />
            {showSuggestions && (
              <div className={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <div
                    key={s}
                    className={`${styles.suggestion} ${i === suggestionIndex ? styles.selected : ''}`}
                    onMouseDown={() => insertSuggestion(s)}
                  >
                    <span className={styles.sugName}>{`{${s}}`}</span>
                    <span className={styles.sugType}>
                      {BUILT_IN_VARIABLES.includes(s as typeof BUILT_IN_VARIABLES[number]) ? 'built-in' : 'custom'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className={styles.field}>
          <label>Preview</label>
          <Preview
            template={currentItem.template}
            variables={currentItem.variables}
            variableValues={variableValues}
            pageInfo={pageInfo}
          />
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {editingIndex >= 0 && (
          <Button variant="danger" icon="trash" onClick={handleDelete}>
            Delete
          </Button>
        )}
        <Button variant="primary" icon="device-floppy" onClick={handleSave}>
          Save
        </Button>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span>Built-in:</span>
        <code>{'{CURRENT_PAGE_URL}'}</code>
        <code>{'{CURRENT_PAGE_TITLE}'}</code>
      </div>
    </div>
  )
}

// Preview component
function Preview({
  template,
  variables,
  variableValues,
  pageInfo,
}: {
  template: string
  variables: Record<string, string>
  variableValues: Record<string, string>
  pageInfo: { url: string; title: string }
}) {
  if (!template) {
    return <div className={styles.preview}><em>Preview will appear here...</em></div>
  }

  let result = template

  // Replace built-in variables
  result = result.replace(/\{CURRENT_PAGE_URL\}/g, pageInfo.url || 'https://example.com')
  result = result.replace(/\{CURRENT_PAGE_TITLE\}/g, pageInfo.title || 'Page Title')

  // Replace custom variables
  for (const name of Object.keys(variables)) {
    const value = variableValues[name] || `[${name}]`
    result = result.replace(
      new RegExp(`\\{${name}\\}`, 'g'),
      `<span class="${styles.varHighlight}">${value}</span>`
    )
  }

  // Parse markdown links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Convert newlines
  result = result.replace(/\n/g, '<br>')

  return (
    <div
      className={styles.preview}
      dangerouslySetInnerHTML={{ __html: result }}
    />
  )
}

