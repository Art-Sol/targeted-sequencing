import { z } from 'zod';

// ============================================================
// Zod-схемы для results.json пайплайна — единый источник правды
// ============================================================
//
// Схемы и типы определены здесь (в shared/), чтобы:
//   1. Сервер мог валидировать данные пайплайна в рантайме (schema.safeParse).
//   2. И сервер, и клиент получали одинаковые TypeScript-типы через z.infer.
// ============================================================

/** Один детерминант (таргет) в образце */
export const DeterminantSchema = z.object({
  determinant_id: z.string(),
  // .int() — число должно быть целым (без дробной части)
  // .nonnegative() — >= 0
  reference_length: z.number().int().nonnegative(),
  mapped_reads: z.number().int().nonnegative(),
  rpkm: z.number().nonnegative(),
});

/** Режим секвенирования: single-end или paired-end */
export const InputModeSchema = z.enum(['se', 'pe']);

/** Результаты одного образца */
export const SampleSchema = z.object({
  sample_id: z.string(),
  total_mapped_reads: z.number().int().nonnegative(),
  n_determinants: z.number().int().nonnegative(),
  n_detected_determinants: z.number().int().nonnegative(),
  determinants: z.array(DeterminantSchema),
  input_mode: InputModeSchema,
  input_fastq_files: z.array(z.string()),
  bam_file: z.string(),
  bam_index: z.string(),
  rpkm_table: z.string(),
});

/** Метаданные запуска пайплайна */
export const PipelineInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  run_datetime_utc: z.string(),
  threads: z.number().int().positive(),
});

/** Сводная статистика по всем образцам */
export const PipelineSummarySchema = z.object({
  n_samples: z.number().int().nonnegative(),
  total_mapped_reads_across_samples: z.number().int().nonnegative(),
  total_detected_determinants_across_samples: z.number().int().nonnegative(),
});

/** Полный JSON пайплайна (корневой объект results.json) */
export const PipelineResultsSchema = z.object({
  pipeline: PipelineInfoSchema,
  summary: PipelineSummarySchema,
  samples: z.array(SampleSchema),
});

// ============================================================
// Типы, выведенные из схем через z.infer
// ============================================================
//
// z.infer<typeof XSchema> — compile-time-операция. TypeScript читает
// структуру схемы (заданную через цепочки вызовов .object/.string/...)
// и собирает из неё обычный TS-тип. Это значит: схема и тип физически
// не могут разойтись — изменил схему, тип обновится автоматически.

export type Determinant = z.infer<typeof DeterminantSchema>;
export type InputMode = z.infer<typeof InputModeSchema>;
export type Sample = z.infer<typeof SampleSchema>;
export type PipelineInfo = z.infer<typeof PipelineInfoSchema>;
export type PipelineSummary = z.infer<typeof PipelineSummarySchema>;
export type PipelineResults = z.infer<typeof PipelineResultsSchema>;
