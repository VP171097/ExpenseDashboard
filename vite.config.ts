import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds one self-contained dist/index.html that opens straight from disk.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { chunkSizeWarningLimit: 2000 },
})
