import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
const bridge = fileURLToPath(new URL('./bridge.ts', import.meta.url))
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  resolve: { alias: Object.fromEntries(['@tauri-apps/api/core', '@tauri-apps/api/event', '@tauri-apps/plugin-dialog'].map((name) => [name, bridge])) },
  server: { host: '127.0.0.1', port: 1431, strictPort: true },
})
