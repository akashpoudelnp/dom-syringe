// Messaging utilities for Chrome extension

import type { MessageType, PageInfo } from './types'

/**
 * Send message to content script
 */
export async function sendToContent<T>(
  tabId: number,
  message: MessageType
): Promise<T | null> {
  try {
    return await chrome.tabs.sendMessage(tabId, message)
  } catch (error) {
    console.error('Failed to send message to content:', error)
    return null
  }
}

/**
 * Send message to background script
 */
export async function sendToBackground<T>(message: MessageType): Promise<T | null> {
  try {
    return await chrome.runtime.sendMessage(message)
  } catch (error) {
    console.error('Failed to send message to background:', error)
    return null
  }
}

/**
 * Get current active tab
 */
export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab || null
  } catch (error) {
    console.error('Failed to get current tab:', error)
    return null
  }
}

/**
 * Check if we can access a tab (not chrome://, edge://, etc.)
 */
export function canAccessTab(tab: chrome.tabs.Tab): boolean {
  if (!tab.url) return false
  const restrictedProtocols = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'moz-extension://',
  ]
  return !restrictedProtocols.some((protocol) => tab.url!.startsWith(protocol))
}

/**
 * Ensure content script is loaded on a tab
 */
export async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    return true
  } catch {
    // Content script not loaded, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/index.tsx'],
      })
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['src/content/content.css'],
      })
      // Give it a moment to initialize
      await new Promise((resolve) => setTimeout(resolve, 100))
      return true
    } catch (error) {
      console.error('Could not inject content script:', error)
      return false
    }
  }
}

/**
 * Get page info from content script
 */
export async function getPageInfo(tabId: number): Promise<PageInfo | null> {
  return sendToContent<PageInfo>(tabId, { type: 'GET_PAGE_INFO' })
}

