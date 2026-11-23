import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { viteAiPlugin } from './server/viteAiPlugin'

export default defineConfig(({ mode }) => {
  // Load .env* into process.env for the AI proxy (keys stay server-side).
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }

  return {
    plugins: [react(), tailwindcss(), viteAiPlugin()],
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    },
  }
})
