import path from 'node:path';

export const ROOT = path.join(__dirname, '..', '..');
export const SERVER_DIR = path.join(ROOT, 'server');
// Dev: запускаем TS-исходник через tsx (JIT-компиляция).
// Prod: запускаем уже собранный JS через Electron-Node (см. spawnServer).
export const SERVER_ENTRY_DEV = path.join(SERVER_DIR, 'src', 'index.ts');
export const SERVER_ENTRY_PROD = path.join(SERVER_DIR, 'dist', 'index.cjs');
export const CLIENT_DIR = path.join(ROOT, 'client');
// Прямой путь к tsx CLI вместо tsx.cmd-обёртки — обходит windows shell-quoting.
export const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
// Прямой путь к vite CLI по той же причине.
export const VITE_CLI = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
// Loopback-адрес: Express из Electron слушает только локальную петлю,
// невидим для соседей по сети.
export const SERVER_HOST = '127.0.0.1';
// Vite dev-server слушает 5173 — стандарт Vite, и проще зашить, чем рандомить.
export const VITE_PORT = 5173;

// Имя bundled tar-архива с Docker-образом пайплайна (gzip-сжатый, ~30-40 MB).
// `docker load` поддерживает оба формата (.tar и .tar.gz) — компрессия
// определяется по magic bytes файла, не по расширению.
// В dev лежит в electron/resources/, в prod — в process.resourcesPath
// (electron-builder копирует туда через extraResources).
export const BUNDLED_IMAGE_TAR_NAME = 'targets-pipeline_0.1.0.tar.gz';
export const RESOURCES_DIR_DEV = path.join(ROOT, 'electron', 'resources');

// Имя подпапки в userData для рабочей директории пайплайна (input_data, output, staging, logs).
// В dev pipelineWorkdir лежит в корне репозитория (наглядно), в prod — в %APPDATA%/<app-name>/
// (единственное место, куда Electron-приложение гарантированно может писать).
export const PIPELINE_WORKDIR_NAME = 'pipeline-workdir';
export const PIPELINE_WORKDIR_DEV = path.join(ROOT, PIPELINE_WORKDIR_NAME);
