/**
 * Константы конфигурации сервера, считываемые из переменных окружения.
 *
 * - В Electron-режиме их выставляет Electron main process через `spawn(..., { env })`.
 * - В browser-dev режиме (`npm run dev` без Electron) env пустое — берутся defaults.
 *
 * Defaults подобраны безопасно (loopback, без токена) — overrides через env.
 */

export const PORT = Number(process.env.PORT) || 3001;
export const HOST = process.env.HOST || '127.0.0.1';
export const AUTH_TOKEN = process.env.AUTH_TOKEN;
