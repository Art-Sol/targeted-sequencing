import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload.js';
import { errorHandler } from './middleware/errorHandler.js';

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

/**
 * Проверка здоровья сервера.
 * Используется для быстрой проверки: сервер запущен и отвечает.
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * app.use('/api/upload', uploadRouter) — подключает роутер загрузки файлов.
 *
 * Все роуты внутри uploadRouter будут доступны по путям:
 *   POST   /api/upload/reads-list
 *   POST   /api/upload/fastq
 *   GET    /api/upload/status
 *   DELETE /api/upload/clean
 */
app.use('/api/upload', uploadRouter);

// ============================================================
// Обработка ошибок (должен быть ПОСЛЕДНИМ middleware)
// ============================================================

/**
 * Error handler ОБЯЗАН быть подключён после всех роутов.
 *
 * Express обрабатывает middleware в порядке подключения:
 *   1. cors()
 *   2. express.json()
 *   3. роуты (health, upload)
 *   4. errorHandler  ← сюда попадают все ошибки из шагов выше
 *
 * Если подключить errorHandler раньше роутов — он никогда не получит их ошибки.
 */
app.use(errorHandler);

// ============================================================
// Запуск сервера
// ============================================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
