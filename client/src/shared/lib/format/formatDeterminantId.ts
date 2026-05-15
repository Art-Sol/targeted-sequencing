// ============================================================
// Преобразование determinant_id → человекочитаемое имя
// ============================================================
//
// Формат ID от пайплайна: [Имя_организма]_[NCBI_accession].[версия]|[start-end]
//   - Bacillus_anthracis_NC_007322.2|601-1200
//   - pINV_CP151293.1|601-1200
//   - Salmonella_enterica_subsp_enterica_serovar_Typhi_str_CT18_NC_003198.1|461851-462450
//
// Цель: в таблице показывать только имя организма ("Bacillus anthracis"),
// но при коллизии (два таргета у одного организма на разных позициях)
// различать их координатами в скобках: "Bacillus anthracis (601-1200)".
// ============================================================

/**
 * Regex для разбора determinant_id. Группы:
 *   1. имя организма (до accession)
 *   2. accession целиком (NC_007322.2, NZ_CP013742.1, CP151293.1, AE003853.1, ...)
 *   3. координаты (start-end)
 *
 * Покрываемые форматы accession:
 *   - RefSeq classic:    [A-Z]+_\d+\.\d+      (NC_007322.2)
 *   - RefSeq from GB:    [A-Z]+_[A-Z]+\d+\.\d+ (NZ_CP013742.1)
 *   - GenBank direct:    [A-Z]+\d+\.\d+       (CP151293.1, AE003853.1)
 *
 * Non-greedy (.+?) для имени гарантирует, что accession сматчится с
 * самого правого валидного места — иначе для длинных имён вроде
 * Salmonella_enterica_subsp_..._CT18_NC_003198.1 движок мог бы
 * остановиться раньше.
 */
const DETERMINANT_ID_REGEX = /^(.+?)_([A-Z]+(?:_[A-Z]*)?\d+\.\d+)\|(\d+-\d+)$/;

interface ParsedId {
  /** Имя организма с подчёркиваниями заменёнными на пробелы (или исходный ID, если не распарсилось) */
  name: string;
  /** Координаты start-end или null если ID не распарсился */
  coords: string | null;
}

function parseDeterminantId(id: string): ParsedId {
  const match = id.match(DETERMINANT_ID_REGEX);
  // Группы 1 и 3 нерасширяемые (обязательные), но TS с noUncheckedIndexedAccess
  // не верит, что массив-доступ безопасен — отсюда явная защита.
  const name = match?.[1];
  const coords = match?.[3];
  if (name === undefined || coords === undefined) return { name: id, coords: null };
  return { name: name.replace(/_/g, ' '), coords };
}

/**
 * Строит соответствие исходный ID → отображаемое имя.
 *
 * Два прохода:
 *  1. Парсим каждый ID, считаем сколько раз встречается каждое имя.
 *  2. Для уникальных имён — возвращаем чистое имя.
 *     Для коллизий — добавляем координаты в скобках: "Bacillus anthracis (601-1200)".
 *
 * Если ID не подошёл под формат — возвращается как есть (защита от новых
 * форматов от пайплайна).
 */
export function buildDeterminantDisplayMap(ids: string[]): Map<string, string> {
  const parsed = ids.map((id) => ({ id, ...parseDeterminantId(id) }));

  const nameCounts = new Map<string, number>();
  for (const p of parsed) {
    nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);
  }

  const result = new Map<string, string>();
  for (const p of parsed) {
    const hasCollision = (nameCounts.get(p.name) ?? 0) > 1;
    const display = hasCollision && p.coords ? `${p.name} (${p.coords})` : p.name;
    result.set(p.id, display);
  }

  return result;
}
