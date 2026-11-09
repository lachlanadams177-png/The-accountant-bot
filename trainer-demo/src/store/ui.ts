import { create } from 'zustand'
import type { ID, ISODate } from '../types'

/** Transient UI state that should not persist (open dialogs etc). */
export interface QuickSessionPrefill { clientId?: ID; date?: ISODate; html?: string; name?: string }

export const useUi = create<{
  quickSession: QuickSessionPrefill | null
  openQuickSession: (p?: QuickSessionPrefill) => void
  closeQuickSession: () => void
  addClientOpen: boolean
  setAddClientOpen: (v: boolean) => void
}>((set) => ({
  quickSession: null,
  openQuickSession: (p = {}) => set({ quickSession: p }),
  closeQuickSession: () => set({ quickSession: null }),
  addClientOpen: false,
  setAddClientOpen: (v) => set({ addClientOpen: v }),
}))
