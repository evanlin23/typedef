// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // Assuming you still need this

// https://vite.dev/config/
export default defineConfig({
  base: '/ioctl/', // Your existing base path
  plugins: [
    react(),
    tailwindcss(), // Your existing Tailwind plugin
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
});