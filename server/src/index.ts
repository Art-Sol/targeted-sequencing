import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import uploadRouter from './routes/upload.js';
import pipelineRouter from './routes/pipeline.js';
import healthRouter from './routes/health.js';
import resultsRouter from './routes/results.js';
import { errorHandler } from './middleware/errorHandler.js';
import { killOrphanContainer, cleanupStaging } from './services/dockerService.js';
import { PORT, HOST, AUTH_TOKEN } from './processConsts.js';
import { CLIENT_DIST } from './consts.js';
import { registerGracefulShutdown } from './shutdown.js';

const app = express();

// ============================================================
// Глобальные middleware
// ============================================================

/**
 * cors() — разрешает кросс-доменные запросы.
 *
 * Без CORS браузер заблокирует запросы с http://localhost:5173 (Vite)
 * на http://localhost:3001 (Express), потому что это разные "origins"
 * (разные порты = разные домены с точки зрения браузера).
 *
 * В продакшене (Electron) это не нужно — всё на одном порту,
 * но при разработке без CORS фронтенд не сможет общаться с бэкендом.
 */
app.use(cors());

/**
 * express.json() — парсит тело запроса в формате JSON.
 * Без этого req.body будет undefined при POST-запросах с JSON.
 */
app.use(express.json());

/**
 * Auth-middleware. Применяется ТОЛЬКО к `/api/*` — статика (index.html, JS, CSS)
 * отдаётся без токена, иначе renderer не сможет загрузить даже стартовую страницу.
 *
 * Активен только если задан AUTH_TOKEN (т.е. сервер запущен из-под Electron).
 * В browser-dev режиме токена нет — middleware не регистрируется.
 */
if (AUTH_TOKEN) {
  app.use('/api', (req, res, next) => {
    const auth = req.header('authorization') ?? '';
    if (auth !== `Bearer ${AUTH_TOKEN}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });
}

// ============================================================
// Роуты
// ============================================================

app.use('/api/health', healthRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/results', resultsRouter);

// ============================================================
// Статика клиента (только в Electron-prod, где client/dist собран)
// ============================================================
//
// В browser-dev режиме UI отдаёт Vite на :5173, эта папка не используется
// (даже если существует от прошлой сборки — пользователь идёт на :5173, не сюда).
// В Electron-prod рендерер грузится отсюда: window.loadURL('http://127.0.0.1:port/').

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

// ============================================================
// Обработка ошибок (должен быть ПОСЛЕДНИМ middleware)
// ============================================================

app.use(errorHandler);

// ============================================================
// Запуск сервера
// ============================================================

async function start() {
  // Если предыдущая сессия Electron упала с running-пайплайном, контейнер
  // живёт сиротой. Убиваем его — без stdio-pipe к нему всё равно ничего полезного.
  await killOrphanContainer();

  // Зачистка осиротевших staging-папок от упавших/прерванных запусков.
  // После killOrphanContainer state.runId === null, так что чистим всё.
  await cleanupStaging();

  const httpServer = app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });

  registerGracefulShutdown(httpServer);
}

start();
