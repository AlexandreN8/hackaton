import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // En dev, /referentiel, /calculate, etc. → backend local
      '/referentiel':  'http://localhost:8000',
      '/calculate':    'http://localhost:8000',
      '/rt':           'http://localhost:8000',
      '/history':      'http://localhost:8000',
      '/stream-reco':  'http://localhost:8000',
    }
  },
  build: { outDir: 'dist' }
})
