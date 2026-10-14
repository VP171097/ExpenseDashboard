import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/*
 * `npm run build`        -> dist/: split into chunks so the dashboard loads first and screens, 3D and Excel load on demand.
 * `npm run build:single` -> dist-single/index.html: one self-contained file that opens straight from disk.
 */
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: mode === 'single' ? {} : {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return
          if (/three|@react-three/.test(id)) return 'three'
          if (/xlsx/.test(id)) return 'xlsx'
          if (/recharts|d3-|victory/.test(id)) return 'charts'
          if (/framer-motion|react-dom|react\//.test(id)) return 'vendor'
        },
      },
    },
  },
}))
