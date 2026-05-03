import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SERVER_PORT переопределяется Electron'ом в dev-режиме (там Express
// слушает на случайном порту). В browser-dev режиме (`npm run dev`)
// переменной нет — fallback 3001.
const SERVER_PORT = process.env.SERVER_PORT || '3001';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind на IPv4-loopback явно. Без этого на Node 17+ Vite по умолчанию
    // биндится только на ::1 (IPv6), и Electron'овский waitForVite по
    // 127.0.0.1 ловит ECONNREFUSED → не дожидается готовности → окно не открывается.
    // Браузеры умеют резолвить localhost в IPv4 при отсутствии IPv6, поэтому
    // browser-dev (`npm run dev`) тоже работает.
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        changeOrigin: true,
        // Отключаем таймаут для прокси — FASTQ-файлы до 2 GB
        // могут загружаться минутами, стандартный таймаут прервёт загрузку
        timeout: 0,
      },
    },
  },
});
