import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Отключаем таймаут для прокси — FASTQ-файлы до 2 GB
        // могут загружаться минутами, стандартный таймаут прервёт загрузку
        timeout: 0,
      },
    },
  },
});
