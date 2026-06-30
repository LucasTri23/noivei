import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

// Mock de módulos externos nos testes
vi.mock('@/lib/integrations/posthog/server', () => ({
  captureEvent:     vi.fn(),
  isFeatureEnabled: vi.fn().mockResolvedValue(false),
}))

vi.mock('next/navigation', () => ({
  useRouter:     vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  usePathname:   vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
