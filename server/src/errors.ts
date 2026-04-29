// ============================================================
// Пользовательские классы HTTP-ошибок
// ============================================================
//
// Идея: любое место в бизнес-логике (service) может выбросить
// свою семантическую ошибку — NotFoundError, ConflictError и т.д.
// Центральный errorHandler (middleware) распознаёт их по instanceof
// и отдаёт клиенту правильный HTTP-статус.
//
// Таким образом сервисы не знают ничего про Express/HTTP,
// а роуты остаются тонкими: try { ... } catch (err) { next(err) }.
// ============================================================

/**
 * Базовый класс для всех HTTP-специфичных ошибок приложения.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    // По умолчанию Error.name = 'Error'. Подменяем на имя конкретного
    // класса (NotFoundError, ConflictError...). Это даёт красивые логи
    // и корректный вывод при err.toString().
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

/** 404 — ресурс не найден */
export class NotFoundError extends HttpError {
  constructor(message = 'Не найдено') {
    super(404, message);
  }
}

/** 409 — конфликт состояния (например, пайплайн уже запущен) */
export class ConflictError extends HttpError {
  constructor(message = 'Конфликт состояния') {
    super(409, message);
  }
}

/** 400 — некорректный запрос (валидация) */
export class BadRequestError extends HttpError {
  constructor(message = 'Некорректный запрос') {
    super(400, message);
  }
}
