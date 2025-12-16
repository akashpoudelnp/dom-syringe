import { create } from 'zustand'
import type { CopyItem, PageInfo, LastSelection } from '@/lib/types'
import { storage, generateId, STORAGE_KEYS } from '@/lib'

interface AppState {
  // Data
  copyItems: CopyItem[]
  currentItem: CopyItem | null
  editingIndex: number
  pageInfo: PageInfo

  // UI State
  view: 'list' | 'editor'
  isPickerActive: boolean
  pendingVariableName: string | null
  toastMessage: string | null
  toastType: 'success' | 'error' | null

  // Actions
  loadCopyItems: () => Promise<void>
  setCurrentItem: (item: CopyItem | null) => void
  setEditingIndex: (index: number) => void
  setPageInfo: (info: PageInfo) => void
  setView: (view: 'list' | 'editor') => void

  // CRUD
  createItem: () => void
  editItem: (index: number) => void
  saveItem: () => Promise<void>
  deleteItem: () => Promise<void>

  // Variables
  addVariable: (name: string, selector: string) => void
  updateVariable: (oldName: string, newName: string) => void
  removeVariable: (name: string) => void
  updateTemplate: (template: string) => void
  updateItemName: (name: string) => void

  // Picker
  startPicker: (variableName: string) => void
  stopPicker: () => void
  handleSelection: (selection: LastSelection) => void

  // Toast
  showToast: (message: string, type: 'success' | 'error') => void
  hideToast: () => void

  // Recovery
  checkPendingSelection: () => Promise<void>
  saveEditingState: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  copyItems: [],
  currentItem: null,
  editingIndex: -1,
  pageInfo: { url: '', title: '' },
  view: 'list',
  isPickerActive: false,
  pendingVariableName: null,
  toastMessage: null,
  toastType: null,

  // Load copy items from storage
  loadCopyItems: async () => {
    const items = await storage.getCopyItems()
    set({ copyItems: items })
  },

  setCurrentItem: (item) => set({ currentItem: item }),
  setEditingIndex: (index) => set({ editingIndex: index }),
  setPageInfo: (info) => set({ pageInfo: info }),
  setView: (view) => set({ view }),

  // CRUD operations
  createItem: () => {
    const newItem: CopyItem = {
      id: generateId(),
      name: '',
      template: '',
      variables: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set({ currentItem: newItem, editingIndex: -1, view: 'editor' })
  },

  editItem: (index) => {
    const { copyItems } = get()
    const item = copyItems[index]
    if (item) {
      set({ currentItem: { ...item }, editingIndex: index, view: 'editor' })
    }
  },

  saveItem: async () => {
    const { currentItem, editingIndex, copyItems } = get()
    if (!currentItem || !currentItem.name.trim()) return

    const updatedItem = { ...currentItem, updatedAt: Date.now() }
    let newItems: CopyItem[]

    if (editingIndex >= 0) {
      newItems = [...copyItems]
      newItems[editingIndex] = updatedItem
    } else {
      newItems = [...copyItems, updatedItem]
    }

    await storage.saveCopyItems(newItems)
    set({ copyItems: newItems, view: 'list', currentItem: null, editingIndex: -1 })

    // Notify background to rebuild menu
    chrome.runtime.sendMessage({ type: 'REBUILD_MENU' })
  },

  deleteItem: async () => {
    const { currentItem, copyItems } = get()
    if (!currentItem) return

    const newItems = copyItems.filter((item) => item.id !== currentItem.id)
    await storage.saveCopyItems(newItems)
    set({ copyItems: newItems, view: 'list', currentItem: null, editingIndex: -1 })

    // Notify background to rebuild menu
    chrome.runtime.sendMessage({ type: 'REBUILD_MENU' })
  },

  // Variable operations
  addVariable: (name, selector) => {
    const { currentItem } = get()
    if (!currentItem) return

    set({
      currentItem: {
        ...currentItem,
        variables: { ...currentItem.variables, [name]: selector },
      },
    })
  },

  updateVariable: (oldName, newName) => {
    const { currentItem } = get()
    if (!currentItem) return

    const { [oldName]: selector, ...rest } = currentItem.variables
    const newVariables = { ...rest, [newName]: selector }

    // Also update template
    const newTemplate = currentItem.template.replace(
      new RegExp(`\\{${oldName}\\}`, 'g'),
      `{${newName}}`
    )

    set({
      currentItem: {
        ...currentItem,
        variables: newVariables,
        template: newTemplate,
      },
    })
  },

  removeVariable: (name) => {
    const { currentItem } = get()
    if (!currentItem) return

    const { [name]: _, ...rest } = currentItem.variables
    set({
      currentItem: {
        ...currentItem,
        variables: rest,
      },
    })
  },

  updateTemplate: (template) => {
    const { currentItem } = get()
    if (!currentItem) return
    set({ currentItem: { ...currentItem, template } })
  },

  updateItemName: (name) => {
    const { currentItem } = get()
    if (!currentItem) return
    set({ currentItem: { ...currentItem, name } })
  },

  // Picker operations
  startPicker: (variableName) => {
    set({ isPickerActive: true, pendingVariableName: variableName })
  },

  stopPicker: () => {
    set({ isPickerActive: false, pendingVariableName: null })
  },

  handleSelection: (selection) => {
    const { currentItem, pendingVariableName } = get()
    if (!currentItem || !pendingVariableName) return

    set({
      currentItem: {
        ...currentItem,
        variables: {
          ...currentItem.variables,
          [pendingVariableName]: selection.selector,
        },
      },
      isPickerActive: false,
      pendingVariableName: null,
    })
  },

  // Toast operations
  showToast: (message, type) => {
    set({ toastMessage: message, toastType: type })
    setTimeout(() => get().hideToast(), 2500)
  },

  hideToast: () => {
    set({ toastMessage: null, toastType: null })
  },

  // Recovery operations
  checkPendingSelection: async () => {
    const lastSelection = await storage.getLocal<LastSelection>(STORAGE_KEYS.LAST_SELECTION)

    if (lastSelection && Date.now() - lastSelection.timestamp < 30000) {
      const editingIndex = await storage.getLocal<number>(STORAGE_KEYS.EDITING_ITEM_INDEX)
      const editingDraft = await storage.getLocal<CopyItem>(STORAGE_KEYS.EDITING_ITEM_DRAFT)

      if (editingDraft) {
        const updatedItem = {
          ...editingDraft,
          variables: {
            ...editingDraft.variables,
            [lastSelection.variableName]: lastSelection.selector,
          },
        }

        set({
          currentItem: updatedItem,
          editingIndex: editingIndex ?? -1,
          view: 'editor',
        })
      }

      // Clear pending selection
      await storage.removeLocal(STORAGE_KEYS.LAST_SELECTION)
    }

    // Clear old data
    await storage.removeLocal(STORAGE_KEYS.PENDING_PICKER)
    await storage.removeLocal(STORAGE_KEYS.EDITING_ITEM_INDEX)
    await storage.removeLocal(STORAGE_KEYS.EDITING_ITEM_DRAFT)
  },

  saveEditingState: async () => {
    const { currentItem, editingIndex } = get()
    if (currentItem) {
      await storage.setLocal(STORAGE_KEYS.EDITING_ITEM_INDEX, editingIndex)
      await storage.setLocal(STORAGE_KEYS.EDITING_ITEM_DRAFT, currentItem)
    }
  },
}))

