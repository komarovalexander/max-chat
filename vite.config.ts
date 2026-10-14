import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — сборку можно открыть с любого пути (GitHub Pages, Netlify, локально).
export default defineConfig({
  base: './',
  plugins: [react()],
});
