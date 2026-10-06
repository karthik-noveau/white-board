import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { previewRouting } from './scripts/preview-routing.mjs'
import { brand } from './src/lib/brand.js'

// Parallel development servers must not replace each other's optimized modules.
const portIndex = process.argv.indexOf('--port')
const port = process.argv.find(argument => argument.startsWith('--port='))?.slice(7)
  || (portIndex >= 0 ? process.argv[portIndex + 1] : '')
const cacheKey = /^\d+$/.test(port) ? port : `process-${process.pid}`

export default defineConfig({
  cacheDir: `node_modules/.vite-drawanything-${cacheKey}`,
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-router', 'dompurify'],
  },
  plugins: [react(), {
    name: 'brand-document',
    transformIndexHtml(html) {
      // Refresh browser and installed-app icons when the public identity changes.
      return html.replace(/href="(\/(?:brand\.svg|icons\/[^"?]+\.png|manifest\.webmanifest))"/g, `href="$1?v=${brand.assetVersion}"`)
    },
  }, previewRouting()],
})
