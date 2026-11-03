import { z } from "zod";

const isoDayPattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDay(value: string): boolean {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = value
    .split("-")
    .map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const dayKeySchema = z
  .string()
  .refine((value) => isoDayPattern.test(value) && isValidIsoDay(value), {
    message: "Fecha inválida.",
  });

const MAX_REPORT_DAYS = 400;

export const reportsRangeSchema = z
  .object({
    dateFrom: dayKeySchema,
    dateTo: dayKeySchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "La fecha final debe ser igual o posterior a la inicial.",
      });
      return;
    }
    const spanDays =
      (Date.parse(`${value.dateTo}T00:00:00.000Z`) - Date.parse(`${value.dateFrom}T00:00:00.000Z`)) /
      86_400_000;
    if (spanDays > MAX_REPORT_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "El periodo no puede superar 400 días.",
      });
    }
  });

export type ReportsRangeInput = z.infer<typeof reportsRangeSchema>;
