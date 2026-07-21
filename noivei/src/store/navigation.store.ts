import { create } from 'zustand'

interface NavigationState {
  isNavigating:    boolean
  startNavigating: () => void
  stopNavigating:  () => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  isNavigating: false,
  startNavigating: () => set({ isNavigating: true }),
  stopNavigating:  () => set({ isNavigating: false }),
}))
