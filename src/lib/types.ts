// Shared types for DOM Syringe

export interface Variable {
  name: string
  selector: string
  value?: string
}

export interface CopyItem {
  id: string
  name: string
  template: string
  variables: Record<string, string> // varName -> selector
  createdAt: number
  updatedAt: number
}

export interface PickerState {
  active: boolean
  variableName: string | null
  timestamp: number
}

export interface LastSelection {
  variableName: string
  selector: string
  text: string
  tagName: string
  timestamp: number
}

// Message types for communication between popup, background, and content scripts
export type MessageType =
  | { type: 'PING' }
  | { type: 'START_PICKER'; variableName: string }
  | { type: 'STOP_PICKER' }
  | { type: 'CONFIRM_SELECTION' }
  | { type: 'GET_ELEMENT_VALUE'; selector: string }
  | { type: 'GET_PAGE_INFO' }
  | { type: 'ELEMENT_SELECTED'; variableName: string; selector: string; text: string; tagName: string }
  | { type: 'PICKER_CANCELLED' }
  | { type: 'REBUILD_MENU' }

export interface PageInfo {
  url: string
  title: string
}

