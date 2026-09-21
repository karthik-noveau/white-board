import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// Parallel development servers must not replace each other's optimized modules.
const portIndex = process.argv.indexOf('--port')
const port = process.argv.find(argument => argument.startsWith('--port='))?.slice(7)
  || (portIndex >= 0 ? process.argv[portIndex + 1] : '')
const cacheKey = /^\d+$/.test(port) ? port : `process-${process.pid}`

export default defineConfig({
  cacheDir: `node_modules/.vite-nova-${cacheKey}`,
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-router', 'dompurify'],
  },
  plugins: [react()],
})
