import { describe, expect, it } from "vitest";
import { formatBs, percentOfCents, roundHalfUp, subtractCents, sumCents, toCents } from "./money";

describe("toCents", () => {
  it.each([
    ["46,50", 4650],
    ["46,5", 4650],
    ["0,05", 5],
    ["1.234,50", 123450],
    ["1.234.567,89", 123456789],
    ["1,234.50", 123450],
    ["46.5", 4650],
    ["1.234", 123400],
    ["Bs 1.234,50", 123450],
    ["Bs.46,50", 4650],
    ["BOB 46,50", 4650],
    ["-5,00", -500],
    ["+7,25", 725],
    ["1234", 123400],
  ])("convierte %s a %i centavos", (input, expected) => {
    expect(toCents(input)).toBe(expected);
  });

  it.each(["", "abc", "1,234", "1,2,3", "1,", ",50", "1.234,567", "--5", "1.2.3.4", "12.34.567"])(
    "rechaza el monto inválido %s",
    (input) => {
      expect(() => toCents(input)).toThrow(RangeError);
    },
  );
});

describe("formatBs", () => {
  it("formatea centavos con separador de miles boliviano", () => {
    expect(formatBs(4650)).toBe("Bs 46,50");
    expect(formatBs(123456)).toBe("Bs 1.234,56");
    expect(formatBs(100000000)).toBe("Bs 1.000.000,00");
    expect(formatBs(0)).toBe("Bs 0,00");
  });

  it("conserva el signo en montos negativos", () => {
    expect(formatBs(-500)).toBe("-Bs 5,00");
  });

  it("rechaza valores que no son centavos enteros", () => {
    expect(() => formatBs(46.5)).toThrow(RangeError);
    expect(() => formatBs(Number.NaN)).toThrow(RangeError);
  });
});

describe("sumCents y subtractCents", () => {
  it("suma centavos sin errores de coma flotante", () => {
    expect(sumCents()).toBe(0);
    expect(sumCents(10, 20)).toBe(30);
    expect(sumCents(1, -5)).toBe(-4);
  });

  it("resta uno o varios valores", () => {
    expect(subtractCents(1000, 465)).toBe(535);
    expect(subtractCents(1000, 200, 300)).toBe(500);
  });

  it("rechaza centavos no enteros", () => {
    expect(() => sumCents(1.5)).toThrow(RangeError);
    expect(() => subtractCents(100, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("roundHalfUp", () => {
  it.each([
    [0.4, 0],
    [0.5, 1],
    [1.5, 2],
    [2.5, 3],
    [-0.5, -1],
    [-1.5, -2],
    [-2.5, -3],
  ])("redondea %f a %i", (input, expected) => {
    expect(roundHalfUp(input)).toBe(expected);
  });

  it("rechaza valores no finitos", () => {
    expect(() => roundHalfUp(Number.NaN)).toThrow(RangeError);
  });
});

describe("percentOfCents", () => {
  it("calcula porcentajes redondeando medio hacia arriba", () => {
    expect(percentOfCents(4650, 10)).toBe(465);
    expect(percentOfCents(101, 50)).toBe(51);
    expect(percentOfCents(100, 7.5)).toBe(8);
    expect(percentOfCents(1999, 10)).toBe(200);
    expect(percentOfCents(100, 0)).toBe(0);
    expect(percentOfCents(100, 100)).toBe(100);
  });

  it("rechaza porcentajes fuera de rango", () => {
    expect(() => percentOfCents(100, -1)).toThrow(RangeError);
    expect(() => percentOfCents(100, 101)).toThrow(RangeError);
  });
});
