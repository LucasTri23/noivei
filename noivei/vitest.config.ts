import { defineConfig } from 'vitest/config'
import react           from '@vitejs/plugin-react'
import tsconfigPaths   from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals:     true,
    setupFiles:  ['./src/tests/setup.ts'],
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines:      80,
        functions:  80,
        branches:   75,
        statements: 80,
      },
      exclude: [
        'node_modules/**', '.next/**', 'src/tests/**',
        '**/*.d.ts', 'src/types/**', 'src/constants/**',
      ],
    },
    include:  ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude:  ['src/tests/e2e/**', 'node_modules/**'],
  },
})
