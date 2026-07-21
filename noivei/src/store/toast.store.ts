import { create } from 'zustand'

export interface ToastItem {
  id:      string
  type:    'success' | 'error'
  message: string
}

interface ToastState {
  toasts:  ToastItem[]
  show:    (type: ToastItem['type'], message: string) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (type, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), type, message }],
    })),
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}))

// Fora de componentes React (ex: handlers async, lib/) — evita repetir
// useToastStore.getState().show(...) em todo lugar que precisa disparar um toast.
export function toastSuccess(message: string): void {
  useToastStore.getState().show('success', message)
}

export function toastError(message: string): void {
  useToastStore.getState().show('error', message)
}
