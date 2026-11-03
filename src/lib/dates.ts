export const LA_PAZ_TIME_ZONE = "America/La_Paz";

const LA_PAZ_OFFSET_MS = -4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const longDateFormatter = new Intl.DateTimeFormat("es-BO", {
  timeZone: LA_PAZ_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-BO", {
  timeZone: LA_PAZ_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-BO", {
  timeZone: LA_PAZ_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Fecha inválida.");
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localParts(date: Date): { year: number; month: number; day: number } {
  const local = new Date(date.getTime() + LA_PAZ_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
  };
}

export function formatDateLong(date: Date): string {
  assertValidDate(date);
  return longDateFormatter.format(date);
}

export function formatDateShort(date: Date): string {
  assertValidDate(date);
  return shortDateFormatter.format(date);
}

export function formatTime(date: Date): string {
  assertValidDate(date);
  return timeFormatter.format(date);
}

export function formatDateTime(date: Date): string {
  return `${formatDateShort(date)} ${formatTime(date)}`;
}

export function laPazDayKey(date: Date): string {
  assertValidDate(date);
  const { year, month, day } = localParts(date);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function startOfLaPazDay(date: Date): Date {
  assertValidDate(date);
  const { year, month, day } = localParts(date);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - LA_PAZ_OFFSET_MS);
}

export function endOfLaPazDay(date: Date): Date {
  return new Date(startOfLaPazDay(date).getTime() + DAY_MS - 1);
}

export function laPazDayBoundsIso(day: string): { start: string; end: string } {
  const [year = 2000, month = 1, date = 1] = day.split("-").map(Number);
  const reference = new Date(Date.UTC(year, month - 1, date, 12));
  return {
    start: startOfLaPazDay(reference).toISOString(),
    end: endOfLaPazDay(reference).toISOString(),
  };
}
