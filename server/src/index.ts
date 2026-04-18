import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload.js';
import pipelineRouter from './routes/pipeline.js';
import healthRouter from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
import { recoverState } from './services/dockerService.js';

const app = express();
const PORT = process.env.PORT || 3001;

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

// ============================================================
// Роуты
// ============================================================

app.use('/api/health', healthRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/pipeline', pipelineRouter);

// ============================================================
// Обработка ошибок (должен быть ПОСЛЕДНИМ middleware)
// ============================================================

app.use(errorHandler);

// ============================================================
// Запуск сервера
// ============================================================

async function start() {
  // Восстановление состояния: если Docker-контейнер пайплайна
  // уже запущен (например, сервер перезагрузился), подхватываем его
  await recoverState();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
