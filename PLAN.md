# План: Веб-интерфейс для пайплайна таргетного секвенирования

## Context

Нужно разработать веб-интерфейс для запуска Docker-пайплайна таргетного секвенирования и визуализации результатов. Docker-образ `targets-pipeline:0.1.0` уже готов. Бэкенд-сервера нет — нужно создать с нуля. Приложение будет обёрнуто в Electron для offline-использования на Windows, Linux и macOS.

**Стек**: React + TypeScript + Ant Design (Vite) / Node.js + Express / Electron
**Docker**: внешняя зависимость — пользователь устанавливает самостоятельно
**Таблица**: Ant Design Table (динамические колонки из данных)

---

## Пользовательский флоу (User Flow)

### 1. Запуск приложения → Проверка окружения

Пользователь запускает приложение (Electron или браузер). Приложение автоматически проверяет:

- **Установлен ли Docker?** Если нет — показываем экран-заглушку с понятной инструкцией: "Docker не найден. Установите Docker для вашей ОС" и ссылки/инструкции для Windows, macOS, Linux.
- **Загружен ли Docker-образ пайплайна?** Если нет — приложение **автоматически загружает образ** из встроенного файла `targets-pipeline_0.1.0.tar` (поставляется вместе с Electron-приложением, ~50 MB). Пользователь видит прогресс: "Загрузка образа пайплайна..."

Пока Docker не установлен — основной интерфейс недоступен. Загрузка образа происходит автоматически и прозрачно для пользователя.

### 2. Главный экран → Загрузка данных

После прохождения проверок пользователь попадает на главный экран. Он видит:

- **Зону загрузки файла описания образцов** (list_reads.txt) — drag-and-drop или кнопка выбора файла. Загружается один текстовый файл.
- **Зону загрузки FASTQ-файлов** — drag-and-drop или кнопка. Можно выбрать несколько файлов сразу (.fastq, .fastq.gz). Видны прогресс-бары для каждого файла (файлы могут быть большими).
- **Список загруженных файлов** — после загрузки пользователь видит подтверждение: какие файлы загружены, их размеры.

### 3. Запуск анализа

Когда файлы загружены, становится активной **кнопка "Запустить анализ"**. Пользователь нажимает её.

Перед запуском система автоматически проверяет:

- Загружен ли list_reads.txt?
- Все ли FASTQ-файлы, указанные в list_reads.txt, загружены?
- Если чего-то не хватает — показываем понятное сообщение: "Не найдены файлы: sample2_R1.fastq, sample2_R2.fastq"

Если всё ок — запускается Docker-контейнер с пайплайном.

### 4. Ожидание результатов

Во время работы пайплайна пользователь видит:

- **Статус-индикатор** с текущим состоянием: "Анализ запущен" → "Выполняется обработка..."
- **Кнопка запуска заблокирована** — нельзя запустить повторно
- Анализ может занять от нескольких минут до десятков минут в зависимости от объёма данных

Если пайплайн упал — показываем **красный статус "Ошибка"** с текстом ошибки из stderr Docker-контейнера (раскрываемый блок с деталями).

### 5. Просмотр результатов

После успешного завершения анализа автоматически появляется **таблица результатов**:

- **Строки** = образцы (sample_id)
- **Столбцы** = таргеты (determinant_id)
- **Ячейки** = числовое значение метрики
- **Нулевые ячейки подсвечены зелёным** — это значит "таргет не обнаружен" (хороший результат)
- Если таргетов много — таблица скроллится горизонтально, при этом первая колонка (sample_id) остаётся видимой

Над таблицей пользователь видит **переключатель режима**: "Mapped Reads" / "RPKM". При переключении числа в таблице меняются мгновенно (без повторного запуска анализа).

### 6. Экспорт в CSV

Пользователь нажимает **кнопку "Скачать CSV"**. Скачивается файл с текущим содержимым таблицы:

- Если выбран режим Mapped Reads — в CSV будут mapped_reads
- Если выбран RPKM — в CSV будут значения RPKM

### 7. История запусков

Результаты каждого анализа сохраняются. Пользователь может:

- Просмотреть результаты любого предыдущего запуска через выпадающий список
- Загрузить новые файлы и запустить анализ повторно
- Очистить загруженные файлы для освобождения места (кнопка "Очистить")

Если на диске мало места — приложение покажет предупреждение.

---

## Структура проекта (монорепо)

```
targeted-sequencing/
├── package.json                  # Workspaces: shared, client, server
├── .gitignore
├── PLAN.md                       # Этот файл
│
├── shared/                       # Общие TypeScript-типы (реэкспортируются в server и client)
│   ├── package.json
│   └── types.ts                  # Determinant, Sample, PipelineResults и др.
│
├── server/                       # Node.js + Express + TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # Express entry point
│       ├── routes/
│       │   ├── upload.ts         # POST /api/upload/reads-list, /api/upload/fastq
│       │   ├── pipeline.ts       # POST /api/pipeline/run, GET /api/pipeline/status
│       │   └── results.ts        # GET /api/results
│       ├── services/
│       │   ├── dockerService.ts  # Spawn docker, track state, capture logs
│       │   └── fileService.ts    # File I/O, validation
│       ├── middleware/
│       │   ├── errorHandler.ts   # Централизованная обработка ошибок Express
│       │   └── upload.ts         # Конфигурация multer (diskStorage, лимиты)
│       └── types/
│           └── index.ts
│
├── client/                       # React + TypeScript + Ant Design (Vite)
│   ├── package.json              # Архитектура: Feature-Sliced Design (FSD)
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── app/                        # FSD: слой приложения (инициализация, провайдеры)
│       │   ├── main.tsx                # Точка входа React
│       │   └── App.tsx                 # Корневой компонент
│       ├── widgets/                    # FSD: самостоятельные блоки UI с бизнес-логикой
│       │   └── ui/
│       │       └── FileUpload.tsx      # Загрузка list_reads.txt и FASTQ
│       ├── pages/                      # FSD: слой страниц (полноэкранные view)
│       │   └── ui/
│       │       └── UploadPage.tsx      # Страница загрузки файлов
│       └── shared/                     # FSD: переиспользуемые модули без бизнес-логики
│           ├── api/
│           │   └── client.ts           # axios wrapper
│           └── model/
│               └── types/
│                   └── index.ts        # Реэкспорт типов из shared (монорепо)
│
├── electron/                     # Electron wrapper (фаза 9)
│   ├── main.ts                   # Main process: запуск Express + BrowserWindow
│   └── preload.ts
│
└── pipeline-workdir/             # Рабочая папка для Docker (gitignored)
    ├── list_reads.txt
    ├── input_data/
    └── output/
        └── <run_id>/             # Каждый запуск в отдельной папке (timestamp-based)
```

---

## API эндпоинты

| Метод    | Путь                     | Описание                                                  |
| -------- | ------------------------ | --------------------------------------------------------- |
| `GET`    | `/api/health`            | Проверка Docker + образа                                  |
| `POST`   | `/api/upload/reads-list` | Загрузить list_reads.txt в pipeline-workdir/              |
| `POST`   | `/api/upload/fastq`      | Загрузить FASTQ-файлы в pipeline-workdir/input_data/      |
| `GET`    | `/api/upload/status`     | Список загруженных файлов                                 |
| `POST`   | `/api/pipeline/run`      | Запустить Docker-контейнер (409 если уже запущен)         |
| `GET`    | `/api/pipeline/status`   | Текущий статус: idle/running/done/error + exitCode, error |
| `GET`    | `/api/results`           | Вернуть распарсенный JSON результатов                     |
| `DELETE` | `/api/upload/clean`      | Очистить загруженные файлы (input_data/)                  |
| `GET`    | `/api/results/runs`      | Список всех запусков (история)                            |
| `GET`    | `/api/results/:runId`    | Результаты конкретного запуска                            |

---

## Ключевые решения

### Архитектура фронтенда: Feature-Sliced Design (FSD)

- Фронтенд организован по слоям FSD: `app/`, `pages/`, `shared/`
- `app/` — инициализация приложения (main.tsx, App.tsx, провайдеры)
- `pages/` — полноэкранные страницы
- `shared/` — переиспользуемый код без бизнес-логики (API-клиент, типы, утилиты)
- По мере роста проекта добавятся слои `features/`, `widgets/`, `entities/`

### UI: Ant Design

- Все UI-компоненты (кнопки, загрузка, badge, switch, таблица) — из Ant Design
- Таблица: Ant Design `<Table>` с динамически генерируемыми колонками из данных
- **Offline-нюанс**: иконки Ant Design (`@ant-design/icons`) подключаются локально, НЕ с CDN

### Загрузка больших файлов

- `multer` с disk storage (не memory) — файлы стримятся напрямую на диск
- Лимит: 2 GB на файл
- Ant Design `<Upload.Dragger>` с кастомным `customRequest` для прогресс-бара через axios

### Оркестрация Docker

- `child_process.spawn` (не exec — нет лимита буфера)
- Состояние хранится в памяти сервера (singleton)
- **Восстановление при рестарте**: при старте сервера проверяем `docker ps --filter ancestor=targets-pipeline:0.1.0` — если контейнер жив, восстанавливаем состояние "running" и подключаемся к его stdout/stderr
- Фронтенд поллит `GET /api/pipeline/status` каждые 2-3 секунды
- **Future improvement**: перейти на SSE (Server-Sent Events) для мгновенного обновления статуса и стриминга логов
- Threads = `Math.max(1, os.cpus().length - 1)` — автоматический подбор по количеству ядер CPU (оставляем 1 ядро системе)
- **Монтирование томов**: НЕ использовать `-w /work` — это ломает внутренние пути контейнера (WORKDIR образа = `/app`). Монтировать точечно: `list_reads.txt` → `/app/list_reads.txt:ro`, `staging/<run_id>/` → `/app/input_data/` (RW, без `:ro` — см. staging ниже), выходную папку `output/<run_id>/` → `/app/output/`. Путь к результату задаётся через `--output /app/output/results.json`
- **Пайплайн удаляет входные данные** после завершения (`input_data/`, `quantification/`, `aligned/`). Чтобы не терять оригиналы пользователя, используется **staging-директория** (см. ниже).
- **Staging-директория для FASTQ.** Перед каждым запуском создаётся `pipeline-workdir/staging/<run_id>/`, куда через `fs.link` («hardlink'и») проецируются все файлы из `input_data/`. Hardlink — альтернативная directory entry для той же inode: один и тот же физический файл имеет два имени, без дублирования данных на диске. Операция мгновенная (миллисекунды даже для 10 GB FASTQ) и не требует свободного места. В контейнер монтируется `staging/<run_id>/`, не `input_data/` — пайплайн удаляет из неё hardlink'и, а оригиналы в `input_data/` остаются (у inode ещё есть ссылка из оригинального файла). Fallback: если `fs.link` недоступен (редкий случай — антивирус, экзотическая FS) — `fs.copyFile`.
- **Fire-and-forget запуск.** `POST /api/pipeline/run` не ждёт подготовки — сразу переводит `state.status = 'running'` и возвращает HTTP 200 с `runId`. Длительная работа (создание staging, spawn контейнера) идёт в фоне через `runPipelineBackground(runId).catch(...)`. Ошибки подготовки переводят state в `'error'`; клиент узнаёт через polling `/api/pipeline/status`. Это стандартный паттерн для long-running jobs: быстрый ACK + асинхронный statefull polling. `.catch()` на фоновом промисе обязателен — иначе unhandled rejection положит процесс Node.js.
- **Очистка осиротевших staging при старте сервера.** Если сервер упал во время работы пайплайна, его staging-папка остаётся на диске. При старте вызывается `cleanupStaging()`, который удаляет все подпапки в `staging/`, кроме соответствующей активному `runId` (восстановленному через `recoverState`).

### Проверка Docker при старте

- При запуске приложения вызываем `docker --version`
- Если Docker не найден — показываем Ant Design `<Result>` с инструкцией по установке для текущей ОС
- Проверяем наличие Docker-образа: `docker image inspect targets-pipeline:0.1.0`
- Если образ не найден — **автоматически выполняем** `docker load -i <путь к встроенному tar>`
- Файл `targets-pipeline_0.1.0.tar` (~50 MB) поставляется внутри Electron-приложения (в папке `resources/`)
- Во время загрузки образа показываем Ant Design `<Spin>` с текстом "Загрузка образа пайплайна..."

### Валидация перед запуском

- Парсим list_reads.txt, извлекаем пути FASTQ-файлов
- Проверяем что все указанные файлы загружены
- Если нет — возвращаем 400 с перечислением отсутствующих файлов

### Таблица результатов

- Собираем union всех determinant_id из всех образцов
- Заполняем отсутствующие значения нулями
- Нулевые ячейки подсвечиваются зелёным
- Sticky первая колонка (sample_id) + горизонтальный скролл
- mapped_reads — целые числа, RPKM — 2 знака после запятой

### CSV экспорт

- Генерация на клиенте (buildCsv утилита)
- Скачивание через `Blob` + `URL.createObjectURL`
- Экспортируется текущий режим (mapped_reads или RPKM)

### Управление дисковым пространством

- `DELETE /api/upload/clean` — очистка input_data/ перед новым анализом
- При загрузке файлов сервер проверяет свободное место на диске
- Если свободно менее 1 GB — показываем предупреждение: "Мало свободного места. Рекомендуем очистить загруженные файлы"
- В UI: кнопка "Очистить загруженные файлы" рядом с зоной загрузки
- Ant Design `<Alert type="warning">` при нехватке места

### История запусков

- Каждый запуск пайплайна сохраняет результаты в отдельную папку: `pipeline-workdir/output/<run_id>/`
- `run_id` = timestamp в формате `YYYY-MM-DD_HHmmss` (например, `2024-01-15_143022`)
- `GET /api/results/runs` — возвращает список запусков (run_id, дата, статус)
- `GET /api/results/:runId` — результаты конкретного запуска
- В UI: выпадающий список (Ant Design Select) для выбора запуска над таблицей результатов
- По умолчанию отображается последний успешный запуск

### Electron (offline, кроссплатформенность)

- Express запускается как child process из Electron main process
- BrowserWindow загружает `http://localhost:PORT`
- Все assets (шрифты, иконки Ant Design) бандлятся локально
- `electron-builder` для сборки installer (Windows: exe/msi, macOS: dmg, Linux: AppImage/deb)
- Конфигурация через env-переменные (WORKDIR, PORT, DOCKER_IMAGE)
- **Graceful shutdown**: при закрытии приложения (`app.on('before-quit')`) — остановка Express-сервера и `docker stop <container_id>` если контейнер запущен. Предотвращает зависшие контейнеры-сироты

### Безопасность embedded HTTP-сервера в Electron

Поскольку Express в Electron-режиме обслуживает API локально и при этом имеет доступ к Docker и файловой системе хоста (по сути — RCE-эквивалентный набор возможностей), нужны явные границы изоляции. Любое другое приложение на той же машине физически не должно иметь возможности отправить запрос на наш endpoint.

- **Bind на `127.0.0.1` (loopback), не `0.0.0.0`**: Express слушает только локальную петлю. Соседи по локальной сети не видят сервер вообще, даже если знают порт. По умолчанию Node слушает `0.0.0.0` (все интерфейсы) — нужно явно передать `'127.0.0.1'` в `app.listen(port, host)`.
- **Случайный свободный порт через `listen(0)`**: вместо хардкода (`PORT=3000`) Electron main процесс резервирует порт через `net.createServer().listen(0)` → ОС выдаёт первый свободный → передаём в Express и в renderer. Защищает от конфликтов с другими instances/приложениями и затрудняет атакующему угадывание порта.
- **Передача порта в renderer через preload + `contextBridge`**: main → preload → `window.appConfig = { apiUrl: 'http://127.0.0.1:<port>' }` → axios baseURL берёт оттуда. Renderer не должен догадываться о порте, не должно быть hardcoded URL.
- **Auth-токен в заголовке (опционально, рекомендуется)**: main process генерирует cryptographic random токен при старте (`crypto.randomBytes(32).toString('hex')`), пробрасывает в Express через env-переменную и в renderer через preload. Express middleware проверяет `Authorization: Bearer <token>` на каждом запросе. Защищает от сценария, когда соседнее приложение всё-таки наткнулось на порт и шлёт запросы — без токена 401. На loopback-binding'е attack surface уже мала, но явный gate гигиеничнее.
- **CORS**: запрещено всё, кроме нашего же origin. На практике для локального HTTP это означает: либо вообще не отдаём CORS-заголовков (по умолчанию same-origin only), либо явно whitelist'им один origin Electron-окна.

### Логирование и обработка ошибок пайплайна

- `dockerService.ts` захватывает stdout и stderr Docker-контейнера в реальном времени через `spawn`
- Логи записываются в файл `pipeline-workdir/logs/pipeline_<timestamp>.log` (stdout + stderr с таймстампами)
- Фронтенд получает статус ошибки через `GET /api/pipeline/status` с полем `error` (последние строки stderr)
- Обработка конкретных сценариев:
  - Ошибка подготовки (staging, mkdir) до spawn — ловится в `.catch()` на фоновом промисе, `state.status='error'`, `state.error = err.message`, staging папка чистится
  - `exitCode !== 0` → "Пайплайн завершился с ошибкой" + stderr
  - spawn `ENOENT` → "Docker не запущен"
  - `exitCode === 137` → "Нехватка памяти (OOM)"
  - Таймаут (опционально) → "Анализ превысил максимальное время"
- В UI: красный StatusBadge + краткое сообщение + раскрываемый блок Ant Design `<Collapse>` с полным stderr
- Лог-файлы сохраняются для диагностики — пользователь может отправить файл разработчику

### Кроссплатформенность

- Docker-команды одинаковы на всех ОС
- Пути к файлам: использовать `path.join()` / `path.resolve()` (не хардкодить разделители)
- Electron-builder поддерживает все 3 платформы из коробки

---

## Порядок реализации

### Фаза 0: Инициализация и разведка

1. ~~Инициализировать монорепо (npm workspaces)~~ ✅
2. ~~Создать скелет server/ (Express + TS)~~ ✅
3. ~~Создать скелет client/ (Vite + React + TS + Ant Design)~~ ✅
4. ~~**Загрузить Docker-образ** и **запустить на тестовых данных** — узнать точный формат JSON и путь к файлу результатов~~ ✅
5. ~~Зафиксировать JSON-схему в types~~ ✅

### Фаза 1: Загрузка файлов (бэкенд + фронтенд)

1. ~~Типы для загрузки (shared/types.ts): UploadedFileInfo, UploadStatusResponse, ReadsListEntry, ValidationResult, ApiError~~ ✅
2. ~~Error handling middleware (server/src/middleware/errorHandler.ts)~~ ✅
3. ~~`fileService.ts` — логика работы с файлами (сохранение, парсинг list_reads.txt, валидация, очистка)~~ ✅
4. ~~`POST /api/upload/reads-list` — сохранение list_reads.txt~~ ✅
5. ~~`POST /api/upload/fastq` — сохранение FASTQ с multer disk storage~~ ✅
6. ~~`GET /api/upload/status` — проверка наличия файлов~~ ✅
7. ~~`DELETE /api/upload/clean` — очистка загруженных файлов~~ ✅
   - Конфигурация multer вынесена в отдельный middleware (`server/src/middleware/upload.ts`)
8. ~~Подключение роутов и error handler в server/src/index.ts~~ ✅
9. ~~API-клиент (client/src/api/client.ts) — axios обёртка~~ ✅
10. ~~Ant Design `<Upload.Dragger>` для list_reads.txt и FASTQ~~ ✅
11. ~~Прогресс-бары загрузки + статус загруженных файлов на UI~~ ✅
12. ~~Обновление App.tsx и vite proxy timeout~~ ✅

- Архитектура фронтенда: FSD (app/, pages/, widgets/, shared/)
- Пошаговый UI с Ant Design Steps (шаг 1: описание образцов → шаг 2: FASTQ)
- Кастомные иконки и цвета статусов в Steps (wait/process/finish)
- Утилита formatBytes вынесена в shared/lib/format/

### Фаза 1.5: Настройка ESLint + Prettier

1. ~~ESLint (flat config) + TypeScript + React плагины~~ ✅
2. ~~Prettier + eslint-config-prettier~~ ✅
3. ~~npm scripts: lint, format~~ ✅
4. ~~Форматирование всего существующего кода~~ ✅
5. ~~Настройка VS Code (`.vscode/settings.json`: format on save, ESLint flat config)~~ ✅

### Фаза 2: Docker-оркестрация и управление пайплайном (бэкенд + фронтенд)

1. ~~`dockerService.ts` — spawn Docker, отслеживание состояния, захват stdout/stderr~~ ✅
2. ~~`POST /api/pipeline/run` — валидация файлов + запуск~~ ✅
3. ~~`GET /api/pipeline/status` — текущее состояние~~ ✅
4. ~~`GET /api/health` — проверка Docker + образа~~ ✅
5. ~~Восстановление состояния при рестарте — проверка `docker ps` на старте~~ ✅
6. ~~PipelineControls (Ant Design Button) + StatusBadge (Ant Design Tag/Badge)~~ ✅
7. ~~usePipelineStatus polling hook~~ ✅
8. ~~Блокировка повторного запуска~~ ✅
9. ~~Проверка Docker при старте (Ant Design Result для ошибок)~~ ✅

### Фаза 3: Результаты и таблица (бэкенд + фронтенд) ✅

1. ~~`GET /api/results` — чтение и парсинг JSON из output/~~ ✅
2. ~~Валидация структуры JSON (Zod в shared/schemas, типы выведены через `z.infer`)~~ ✅
3. ~~useResults hook — загрузка и трансформация данных (поверх обобщённого `useFetch`)~~ ✅
4. ~~Матричная трансформация: union determinant_id, заполнение нулей (`buildResultsMatrix`)~~ ✅
5. ~~ResultsTable: Ant Design Table с динамическими колонками~~ ✅
6. ~~MetricToggle (Ant Design Radio.Group: mapped_reads / RPKM)~~ ✅
7. ~~Зелёная подсветка нулей (через `onCell` → className)~~ ✅
8. ~~Sticky-колонка + горизонтальный скролл (`scroll={{ x: 'max-content' }}` + `fixed: 'left'`)~~ ✅

Бонусом сделано по ходу фазы:

- Иерархия HTTP-ошибок (`HttpError` → `NotFoundError` / `ConflictError` / `BadRequestError`), централизованный `errorHandler` распознаёт их по `instanceof` — роуты и сервисы унифицированы
- Базовый хук `useFetch<T>` с `AbortController`, `enabled` и защитой от race conditions; `useResults` и `usePipelineStatus` — адаптеры поверх него
- Staging-директория через hardlinks + fire-and-forget запуск — пайплайн больше не падает на удалении входных FASTQ, а UI показывает `running` сразу после клика

### Фаза 4: CSV экспорт ✅

1. ~~`buildCsv` утилита (с UTF-8 BOM, CRLF, разделитель `;` для русского Excel)~~ ✅
2. ~~`downloadFile` универсальная утилита (Blob + object URL + `<a download>`)~~ ✅
3. ~~`CsvExportButton` (Ant Design Button с иконкой DownloadOutlined, `type="primary"`)~~ ✅
4. ~~Интеграция в `StepActions` шага 3 рядом с «Запустить ещё раз» (показывается только при `pipeline.status === 'done' && results`)~~ ✅
5. ~~Рефактор: `metric`-стейт поднят из `ResultsTable` в `UploadPage` (controlled component)~~ ✅

### Фаза 5: Обработка ошибок, история и полировка ✅

1. ~~UI-ошибки: нет файлов, Docker не запущен, пайплайн упал, невалидный JSON~~ ✅
2. ~~Ant Design message/notification для toast-уведомлений~~ ✅
3. ~~Loading states (Ant Design Spin/Skeleton)~~ ✅
4. ~~История запусков: UI-селектор + эндпоинты `/api/results/runs`, `/api/results/:runId`~~ ✅
5. ~~Управление дисковым пространством: кнопка очистки + предупреждение о нехватке места~~ ✅

Бонусом сделано по ходу фазы:

- Бэкенд: `RUN_ID_REGEX` (`YYYY-MM-DD_HHmmss`) защищает `/api/results/:runId` от path-traversal; `getLatestResults` рефакторнут как надстройка над `listRuns` + `readResultsByRunId`
- Хук `useFetch` расширен опцией `key` — при смене ключа состояние `data` синхронно обнуляется в render (паттерн «set state during render»), убирая фликер при переключении запросов
- `RunSelector` форматирует runId в человекочитаемое `DD.MM.YYYY HH:MM:SS`; упавшие запуски (`hasResults: false`) показаны как disabled с тегом «ошибка»

### Фаза 5.5: UI-рефакторинг — две страницы и FSD-чистка ✅

UI разделён на две страницы с навигацией в шапке («Новый анализ» / «Выполненные анализы») и упорядочен под FSD:

1. ~~`HeaderNav` виджет + `enum PageNames`; `AppLayout` принимает `headerActions` слотом~~ ✅
2. ~~`HistoryPage` — самостоятельная страница (RunSelector + ResultsTable + CSV), без степпера; на «Новом анализе» селектор истории убран — показывается только текущий `pipeline.runId`~~ ✅
3. ~~Disabled-логика хедера: обе кнопки disabled при не-OK Docker; «Выполненные» — также при отсутствии успешных запусков~~ ✅
4. ~~Long-lived hooks (`useHealth`, `useRuns`, `usePipelineStatus`) подняты в `App` — переживают переключение страниц, polling идёт всегда~~ ✅
5. ~~Lifted state: `currentStep`, `metric`, `currentPage` в `App`; server-derived state остаётся локальным и подгружается на mount страниц~~ ✅
6. ~~Реструктура папок: `pages/ui/UploadPage/` и `pages/ui/HistoryPage/` со своими `index.ts`; `steps/` переехал в `UploadPage/`~~ ✅
7. ~~Перенос компонентов в правильные слои: `MetricToggle`, `CsvExportButton` → `shared/ui/`; `RunSelector` → отдельный виджет~~ ✅
8. ~~`formatValue` вынесен в `shared/lib/format/`~~ ✅
9. ~~`ResultsTable` принимает `isLoading` и встроенно показывает скелетон в ячейках/заголовках — оболочка таблицы остаётся на месте, нет layout-jitter'а~~ ✅
10. ~~`DockerCheck` стал «чистым» компонентом — health/loading/onRetry приходят пропсами; контейнер-логика в `App`~~ ✅

### Фаза 5.6: Удаление запусков из истории ✅

Освобождение места на диске через UI: удаление одного или всех запусков.

**Бэкенд:**

1. ~~`resultsService.deleteRun(runId)` — валидация через `RUN_ID_REGEX`, `fs.rm(..., { recursive: true, force: true })`; `BadRequestError` / `NotFoundError`~~ ✅
2. ~~`resultsService.deleteAllRuns()` — только подпапки, соответствующие `RUN_ID_REGEX` (мусор не трогаем)~~ ✅
3. ~~`dockerService.isRunningRunId(runId)` + `isPipelineRunning()` — хелперы для 409~~ ✅
4. ~~`DELETE /api/results/:runId` — 400 / 409 / 404 / 204~~ ✅
5. ~~`DELETE /api/results` — 409 / 204~~ ✅

**Клиентский API:**

6. ~~`deleteRun(runId, signal?)` и `deleteAllRuns(signal?)` в `shared/api/client.ts`~~ ✅

**RunSelector — встроенное управление:**

7. ~~Per-item-удаление: иконка-корзина в каждой опции через `optionRender` (НЕ `label`!) — кнопка показывается только в раскрытом dropdown, не в свёрнутом Select. Клик открывает `Modal.confirm`. `stopPropagation` на `onClick` + `onMouseDown`~~ ✅
8. ~~«Удалить все» — кнопка в подвале dropdown через `popupRender`. Открывает `Modal.confirm`~~ ✅
9. ~~Опциональные пропсы `onDeleteRun?` / `onDeleteAll?` — без них UI не рендерится (back-compat)~~ ✅

**App + HistoryPage:**

10. ~~App владеет колбэками — вызов API + `refetchRuns()` + `message.success/error`~~ ✅
11. ~~Авто-сброс `selectedRunId` через отдельный `useEffect` — если выбранный исчез из `runs`, сброс → effect авто-выбора подхватит следующий~~ ✅

**Решения, отступившие от плана:**

- `Modal.confirm` вместо `Popconfirm` — портал-modal надёжнее работает «поверх» dropdown'a Select'a, без z-index/click-outside проблем
- В RunSelector использован `popupRender` вместо `dropdownRender` (последний deprecated в AntD 5.7+) и `optionRender` для разделения dropdown-вида и свёрнутого вида

### Фаза 6: Electron

1. ~~**Скелет `electron/`**: установить `electron`, `electron-builder`, `concurrently` как dev-зависимости; создать `electron/` с `package.json`, `tsconfig.json`, `src/main.ts` (заглушка), `src/preload.ts` (пустой); npm-скрипты `electron:dev` / `electron:build` в корне.~~ ✅
2. ~~**Минимальный `main.ts` → пустое окно**: `app.whenReady()` → `BrowserWindow` с безопасными `webPreferences` (contextIsolation: true, nodeIntegration: false, preload), `loadURL('about:blank')`.~~ ✅
3. ~~**Express как child process с гигиеной безопасности**~~ ✅:
   - ~~`child_process.spawn` Express из Electron main process через `node + tsx-cli`~~
   - ~~**Bind на `127.0.0.1`** (loopback)~~
   - ~~**Случайный свободный порт** через `net.createServer().listen(0)`~~
   - ~~**Передача конфига в renderer через preload + `contextBridge.exposeInMainWorld`** в base64 (`additionalArguments`) — Chromium не «съедает» аргумент, как при URL-подобных значениях~~
   - ~~**Auth-токен**: `crypto.randomBytes(32).toString('hex')` в main → env Express'у + preload'у → middleware на `/api` проверяет `Authorization: Bearer`~~
   - ~~Health-check polling после spawn'а — окно открывается только когда сервер ответил~~
4. ~~**Dev vs Prod URL**~~ ✅:
   - ~~dev: окно грузит `http://localhost:5173` (Vite спавнится из main с `SERVER_PORT` в env, Vite proxies `/api` на Express)~~
   - ~~prod: окно грузит `http://127.0.0.1:<port>/`, Express отдаёт собранный `client/dist` как статику~~
   - ~~Vite забинден на `127.0.0.1` (а не `localhost`/`::1`) — Node 17+ резолвит `localhost` сначала в IPv6, что ломало `waitForVite`~~
5. ~~**Graceful shutdown**~~ ✅:
   - ~~Electron `before-quit` orchestration: `event.preventDefault()` → `fetchPipelineStatus` → `docker stop pipeline-<runId>` (если жив) → SIGTERM Vite + Express → `waitForProcessExit` 3s → `app.quit()`~~
   - ~~Кросс-платформенно: на Windows kill('SIGTERM') Express'а — это force-kill, поэтому Electron сам зовёт `docker stop` ДО kill сервера~~
   - ~~Server-side handlers (SIGTERM/SIGINT) вынесены в `server/src/shutdown.ts` для standalone-run сценария (Ctrl+C в dev)~~
   - ~~Защита от orphan-контейнера после краха Electron: `killOrphanContainer()` (бывший `recoverState`) на старте сервера — если нашли running контейнер, останавливаем~~
6. ~~**Проверка Docker при старте**: реализовано через `/api/health` — Electron больше не блокирует startup, окно открывается сразу. UI показывает экран ошибки если daemon не отвечает.~~ ✅
7. ~~**Автозапуск Docker Desktop**~~ ✅:
   - ~~Sequential chain методов с per-method таймаутом 20s: `customPath` (из настроек) → `STANDARD_DOCKER_PATH` (Program Files) → `cmd /c start "" "Docker Desktop"` (App Paths registry на Windows); `open -a Docker` на macOS; на Linux skip~~
   - ~~Кнопка «Попробовать запустить программно» в `DockerCheck` (Windows + macOS only) — IPC `docker:retry` на main → ensureDockerRunning~~
   - ~~Persistent settings `electron/src/dockerSettings.ts` (`app.getPath('userData')/docker-settings.json`) для customPath~~
   - ~~Windows-only inline-input в `DockerCheck` для ручного указания пути к Docker Desktop.exe (если standard search промахнулся)~~
   - ~~IPC API через preload: `electronAPI.platform`, `getDockerCustomPath`, `setDockerCustomPath`, `retryDockerLaunch`~~
8. ~~**Загрузка bundled Docker-образа из tar**~~ ✅:
   - ~~Tar лежит в `electron/resources/targets-pipeline_0.1.0.tar.gz` (gzip-сжатый, ~30-40 MB), gitignored~~
   - ~~Lazy auto-load в `/api/health`: если daemon up, image missing, есть `BUNDLED_IMAGE_TAR` env, не идёт загрузка и нет накопившейся ошибки → fire-and-forget `loadImageFromTar`~~
   - ~~UI показывает прогресс через polling `/api/health` каждые 3 сек пока `imageLoading=true`~~
   - ~~Error tracking: после fail'а `imageLoadError` в state блокирует auto-retry (иначе спам); юзер кликает «Попробовать заново» → `POST /api/health/retry-image-load` → clear error + new attempt~~
   - ~~UI: `ImageLoadErrorView` с текстом ошибки от Docker и кнопкой retry~~
9. **Production build через electron-builder** (НЕ НАЧАТО): конфиг для NSIS (Win), DMG (Mac), AppImage+deb (Linux); pipeline сборки: client (Vite) + server (tsc) + electron (tsc) → electron-builder упаковывает с `extraResources` для tar.gz.
10. **Финальные проверки сборки** (НЕ НАЧАТО):
    - все assets (иконки Ant Design, шрифты) бандлятся локально, нет CDN-запросов
    - **CSV-экспорт работает в Electron-сборке**: frontend использует `blob:` URL для скачивания CSV (`client/src/shared/lib/download.ts`). Если в `index.html` или через `webPreferences` задан строгий CSP — он должен разрешать `blob:` (например `default-src 'self' blob: data:;`). Иначе скачивание молча упадёт. Проверить нативный «Save As» диалог на всех трёх ОС.
    - test offline: отключить интернет, всё должно работать.

**Бонусом сделано по ходу фазы**:
- `electron/scripts/launch.cjs` — Node-launcher, удаляющий `ELECTRON_RUN_AS_NODE=1` (если выставлено в окружении пользователя), без чего `require('electron')` отдавал бы строку с путём к бинарнику вместо API-объекта
- ESLint flat config — отдельный блок для `**/*.cjs`: Node-globals (`globals.node`), `sourceType: 'commonjs'`, выключен `@typescript-eslint/no-require-imports`
- Структура `electron/src/`: `main.ts` оставлен только для лайфсайкл-логики; вспомогательное вынесено в `consts.ts`, `serverProcess.ts`, `dockerLauncher.ts`, `dockerSettings.ts`, `placeholder.ts` (удалён в шаге 4)
- Server: вынесен `processConsts.ts` (PORT/HOST/AUTH_TOKEN), `shutdown.ts` (`registerGracefulShutdown`); CLIENT_DIST добавлен в `consts.ts`
- Client `shared/api/client.ts`: request-interceptor добавляет `Authorization: Bearer` из `window.appConfig?.token` (browser-dev режим работает без токена)
- Client `shared/global.d.ts`: типы для `window.appConfig` и `window.electronAPI`
- Client `shared/ui/`: `DockerAutoLaunchButton`, `DockerCustomPathInput` — отдельные компоненты
- Auth-middleware на сервере применяется ТОЛЬКО к `/api/*`, статика отдаётся без токена (иначе renderer не загрузит index.html)

**Известные нюансы / отложено на полировку**:
- Linux: dockerd обычно systemd-managed (требует root), auto-launch'а нет — UI показывает инструкцию `sudo systemctl start docker`
- 32-bit Windows: `process.env.ProgramFiles` через WOW64-редирект; не покрыто (Electron 33+ всегда 64-bit на 64-bit ОС)
- В dev запуск Express через системный `node`. В prod (шаг 9) надо переключиться на `process.execPath` + `ELECTRON_RUN_AS_NODE=1`, чтобы юзеру не требовался установленный Node.js

---

## Библиотеки

**Server:** express, multer, cors, typescript, tsx (dev runner)

**Client:** react, react-dom, vite, antd, @ant-design/icons, axios, typescript

**Electron (фаза 6):** electron, electron-builder, concurrently

---

## Обработка ошибок

| Ошибка                  | Где обрабатывается                   | Как отображается                              |
| ----------------------- | ------------------------------------ | --------------------------------------------- |
| Docker не установлен    | `GET /api/health`                    | Ant Design Result: "Установите Docker"        |
| Docker-образ не найден  | `GET /api/health`                    | Автозагрузка образа из встроенного tar + Spin |
| Нет list_reads.txt      | `POST /api/pipeline/run` (400)       | Ant Design Alert под формой                   |
| Нет FASTQ-файлов        | `POST /api/pipeline/run` (400)       | Alert со списком отсутствующих файлов         |
| Docker не запущен       | `dockerService.ts` spawn error (503) | Notification с текстом ошибки                 |
| Pipeline exit code != 0 | `dockerService.ts` close event       | StatusBadge error + stderr в Modal            |
| JSON не найден          | `GET /api/results` (404)             | Alert: "Результаты не найдены"                |
| Невалидный JSON         | `GET /api/results` (500)             | Alert с деталями ошибки                       |

---

## Верификация

1. Загрузить тестовые файлы (list_reads.txt + FASTQ) через UI
2. Запустить пайплайн, убедиться что статусы меняются корректно
3. Проверить таблицу результатов: все determinant_id присутствуют, нули подсвечены зелёным
4. Переключить mapped_reads ↔ RPKM — значения меняются
5. Экспортировать CSV, открыть в Excel — структура корректна
6. Тест ошибок: запуск без файлов, остановка Docker, повреждённый JSON
7. Тест offline: отключить интернет, убедиться что всё работает
8. Тест кроссплатформенности: проверить на Windows и Linux (macOS если доступен)

---

## Открытые вопросы

- [x] **Точный формат выходного JSON пайплайна** — структура:
  ```json
  {
    "pipeline": { "name", "version", "run_datetime_utc", "threads" },
    "summary": { "n_samples", "total_mapped_reads_across_samples", "total_detected_determinants_across_samples" },
    "samples": [{
      "sample_id": "string",
      "total_mapped_reads": number,
      "n_determinants": number,
      "n_detected_determinants": number,
      "determinants": [{
        "determinant_id": "string",
        "reference_length": number,
        "mapped_reads": number,
        "rpkm": number
      }],
      "input_mode": "se" | "pe",
      "input_fastq_files": ["string"],
      "bam_file": "string",
      "bam_index": "string",
      "rpkm_table": "string"
    }]
  }
  ```
- [x] **Точный путь к файлу результатов** — по умолчанию `results.json` в рабочей директории контейнера (`/app/results.json`). Можно задать через `--output <path>`
- [x] **Команда запуска Docker**: монтировать `list_reads.txt` → `/app/list_reads.txt:ro`, `staging/<run_id>/` → `/app/input_data/` (RW, с hardlink'ами оригинальных FASTQ; см. «Staging-директория для FASTQ» выше), точку вывода `output/<run_id>/` → `/app/output/`. НЕ использовать `-w /work` и НЕ монтировать `input_data` с `:ro` (пайплайн штатно удаляет свои входы и упадёт `EROFS`). Аргументы: `--reads-list /app/list_reads.txt --output /app/output/results.json --threads N`
- [x] **Формат list_reads.txt** — TSV (разделитель — табуляция), колонки:
  1. `sample_id` — имя образца (например, `sample1`)
  2. `type` — `se` (single-end) или `pe` (paired-end)
  3. Путь к FASTQ-файлу (для `se` — 1 путь, для `pe` — 2 пути: R1 и R2)
  - Пример:
    ```
    sample1	se	input_data/test_se.fastq
    sample2	pe	input_data/test_pe_R1.fastq	input_data/test_pe_R2.fastq
    sample3	se	input_data/simulated_reads.fastq.gz
    ```
