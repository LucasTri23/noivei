'use client'

import { useSyncExternalStore } from 'react'

function subscribe() {
  return () => {}
}

function getClientSnapshot(): string {
  return window.location.origin
}

function getServerSnapshot(): string {
  return ''
}

// Lê window.location.origin sem risco de mismatch de hidratação (SSR não tem window) —
// useSyncExternalStore lida com a divergência entre snapshot de servidor e de cliente sem precisar de useEffect.
export function useOrigin(): string {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
