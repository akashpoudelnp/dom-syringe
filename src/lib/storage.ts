import type { CopyItem } from './types'
import { STORAGE_KEYS } from './constants'

// Storage utilities for Chrome extension
export const storage = {
  async getCopyItems(): Promise<CopyItem[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.COPY_ITEMS)
    return (result[STORAGE_KEYS.COPY_ITEMS] as CopyItem[]) || []
  },

  async saveCopyItems(items: CopyItem[]): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEYS.COPY_ITEMS]: items })
  },

  async addCopyItem(item: CopyItem): Promise<void> {
    const items = await this.getCopyItems()
    items.push(item)
    await this.saveCopyItems(items)
  },

  async updateCopyItem(id: string, updates: Partial<CopyItem>): Promise<void> {
    const items = await this.getCopyItems()
    const index = items.findIndex((item) => item.id === id)
    if (index !== -1) {
      items[index] = { ...items[index], ...updates, updatedAt: Date.now() }
      await this.saveCopyItems(items)
    }
  },

  async deleteCopyItem(id: string): Promise<void> {
    const items = await this.getCopyItems()
    const filtered = items.filter((item) => item.id !== id)
    await this.saveCopyItems(filtered)
  },

  // Local storage for temporary state
  async getLocal<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key)
    return (result[key] as T) ?? null
  },

  async setLocal(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },

  async removeLocal(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  },
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

