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
- **Монтирование томов**: НЕ использовать `-w /work` — это ломает внутренние пути контейнера (WORKDIR образа = `/app`). Монтировать точечно: `list_reads.txt` → `/app/list_reads.txt`, `input_data/` → `/app/input_data/`, выходную папку → `/app/output/`. Путь к результату задаётся через `--output /app/output/results.json`
- **Пайплайн удаляет входные данные** после завершения (`input_data/`, `quantification/`, `aligned/`). Это значит, что FASTQ-файлы в рабочей папке будут удалены. Нужно либо копировать файлы перед запуском, либо монтировать input_data как read-only (`:ro`), либо хранить оригиналы отдельно от рабочей директории

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

### Логирование и обработка ошибок пайплайна

- `dockerService.ts` захватывает stdout и stderr Docker-контейнера в реальном времени через `spawn`
- Логи записываются в файл `pipeline-workdir/logs/pipeline_<timestamp>.log` (stdout + stderr с таймстампами)
- Фронтенд получает статус ошибки через `GET /api/pipeline/status` с полем `error` (последние строки stderr)
- Обработка конкретных сценариев:
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

### Фаза 3: Результаты и таблица (бэкенд + фронтенд)

1. `GET /api/results` — чтение и парсинг JSON из output/
2. Валидация структуры JSON
3. useResults hook — загрузка и трансформация данных
4. Матричная трансформация: union determinant_id, заполнение нулей
5. ResultsTable: Ant Design Table с динамическими колонками
6. MetricToggle (Ant Design Radio.Group: mapped_reads / RPKM)
7. Зелёная подсветка нулей (через `onCell` → style)
8. Sticky-колонка + горизонтальный скролл (Ant Design Table `scroll={{ x: true }}` + `fixed: 'left'`)

### Фаза 4: CSV экспорт

1. buildCsv утилита
2. CsvExportButton (Ant Design Button с иконкой DownloadOutlined)

### Фаза 5: Обработка ошибок, история и полировка

1. UI-ошибки: нет файлов, Docker не запущен, пайплайн упал, невалидный JSON
2. Ant Design message/notification для toast-уведомлений
3. Loading states (Ant Design Spin/Skeleton)
4. История запусков: UI-селектор + эндпоинты `/api/results/runs`, `/api/results/:runId`
5. Управление дисковым пространством: кнопка очистки + предупреждение о нехватке места

### Фаза 6: Electron

1. Добавить electron/ с main.ts и preload.ts
2. Запуск Express из main process как child process
3. BrowserWindow → http://localhost:PORT
4. Проверка Docker при старте приложения
5. Автозапуск Docker Desktop, если daemon не запущен (Windows: `Docker Desktop.exe`, macOS: `open -a Docker`)
6. Сборка через electron-builder для Win/Mac/Linux
7. Убедиться что все assets (иконки, шрифты) бандлятся локально
8. Graceful shutdown: остановка Express + docker stop при закрытии приложения

---

## Библиотеки

**Server:** express, multer, cors, typescript, tsx (dev runner)

**Client:** react, react-dom, vite, antd, @ant-design/icons, axios, typescript

**Electron (фаза 9):** electron, electron-builder

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
- [x] **Команда запуска Docker**: монтировать `list_reads.txt` → `/app/list_reads.txt`, `input_data/` → `/app/input_data/`, точку вывода → `/app/output/`. НЕ использовать `-w /work` — это ломает внутренние пути контейнера. Аргументы: `--reads-list /app/list_reads.txt --output /app/output/results.json --threads N`
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
