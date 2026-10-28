import { describe, expect, it } from "vitest";
import {
  endOfLaPazDay,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatTime,
  laPazDayKey,
  startOfLaPazDay,
} from "./dates";

describe("helpers de fecha America/La_Paz", () => {
  it("muestra la fecha local aunque en UTC ya sea el día siguiente", () => {
    const date = new Date("2026-10-27T02:00:00.000Z");

    expect(formatDateLong(date)).toBe("lunes, 26 de octubre");
    expect(formatDateShort(date)).toBe("26/10/2026");
    expect(formatTime(date)).toBe("22:00");
    expect(formatDateTime(date)).toBe("26/10/2026 22:00");
    expect(laPazDayKey(date)).toBe("2026-10-26");
  });

  it("cambia de día a las 04:00 UTC (medianoche en La Paz)", () => {
    const date = new Date("2026-10-27T04:00:00.000Z");

    expect(formatDateLong(date)).toBe("martes, 27 de octubre");
    expect(formatTime(date)).toBe("00:00");
    expect(laPazDayKey(date)).toBe("2026-10-27");
  });

  it("calcula el inicio y el fin del día local", () => {
    const date = new Date("2026-10-27T15:30:00.000Z");

    expect(startOfLaPazDay(date).toISOString()).toBe("2026-10-27T04:00:00.000Z");
    expect(endOfLaPazDay(date).toISOString()).toBe("2026-10-28T03:59:59.999Z");
  });

  it("mantiene el día correcto al cruzar el año", () => {
    const date = new Date("2027-01-01T03:30:00.000Z");

    expect(laPazDayKey(date)).toBe("2026-12-31");
    expect(formatDateLong(date)).toBe("jueves, 31 de diciembre");
  });

  it("rechaza fechas inválidas", () => {
    const invalidDate = new Date("no-es-una-fecha");

    expect(() => formatDateLong(invalidDate)).toThrow(RangeError);
    expect(() => laPazDayKey(invalidDate)).toThrow(RangeError);
  });
});
