export type Cents = number;

function assertIntegerCents(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Monto inválido: se esperaban centavos enteros y se recibió ${value}.`);
  }
}

function invalid(input: string): never {
  throw new RangeError(`Monto inválido: "${input}".`);
}

function stripThousands(value: string, separator: "." | ",", input: string): string {
  if (!value.includes(separator)) return value;

  const groups = value.split(separator);
  const first = groups[0];

  if (!first || first.length < 1 || first.length > 3 || !/^\d+$/.test(first)) {
    invalid(input);
  }

  for (const group of groups.slice(1)) {
    if (!/^\d{3}$/.test(group)) invalid(input);
  }

  return groups.join("");
}

export function toCents(input: string): Cents {
  const compact = input.replace(/[\s\u00a0]/g, "");
  const withoutCurrency = compact.replace(/^Bs\.?/i, "").replace(/^BOB/i, "");

  if (!withoutCurrency) invalid(input);

  const isNegative = withoutCurrency.startsWith("-");
  const body = withoutCurrency.replace(/^[+-]/, "");

  if (!body || !/^\d[\d.,]*$/.test(body)) invalid(input);

  const dotCount = body.split(".").length - 1;
  const commaCount = body.split(",").length - 1;
  let decimalSeparator: "." | "," | null = null;

  if (dotCount > 0 && commaCount > 0) {
    decimalSeparator = body.lastIndexOf(".") > body.lastIndexOf(",") ? "." : ",";
  } else if (commaCount === 1) {
    decimalSeparator = ",";
  } else if (commaCount > 1) {
    invalid(input);
  } else if (dotCount === 1) {
    const dotIndex = body.indexOf(".");
    const decimals = body.length - dotIndex - 1;
    if (decimals === 3) {
      decimalSeparator = null;
    } else if (decimals >= 1 && decimals <= 2) {
      decimalSeparator = ".";
    } else {
      invalid(input);
    }
  }

  let whole = body;
  let fraction = "";

  if (decimalSeparator) {
    const separatorIndex = body.lastIndexOf(decimalSeparator);
    whole = body.slice(0, separatorIndex);
    fraction = body.slice(separatorIndex + 1);
    if (!fraction || fraction.length > 2) invalid(input);

    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    whole = stripThousands(whole, thousandsSeparator, input);
    if (whole.includes(decimalSeparator)) invalid(input);
  } else {
    whole = stripThousands(whole, ".", input);
    whole = stripThousands(whole, ",", input);
  }

  if (!/^\d+$/.test(whole)) invalid(input);

  const units = Number(whole);
  const fractionCents = fraction ? Number(fraction.padEnd(2, "0")) : 0;
  const cents = units * 100 + fractionCents;

  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Monto fuera de rango: "${input}".`);
  }

  return isNegative && cents !== 0 ? -cents : cents;
}

export function formatBs(cents: Cents): string {
  assertIntegerCents(cents);

  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const units = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const groupedUnits = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negative ? "-" : ""}Bs ${groupedUnits},${fraction}`;
}

export function sumCents(...values: Cents[]): Cents {
  let total = 0;

  for (const value of values) {
    assertIntegerCents(value);
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new RangeError("La suma excede el rango seguro de centavos.");
    }
  }

  return total;
}

export function subtractCents(value: Cents, ...subtrahends: Cents[]): Cents {
  return sumCents(value, ...subtrahends.map((subtrahend) => -subtrahend));
}

export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Valor no finito: ${value}.`);
  }

  return value < 0 ? -Math.floor(-value + 0.5) : Math.floor(value + 0.5);
}

export function percentOfCents(cents: Cents, percent: number): Cents {
  assertIntegerCents(cents);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`Porcentaje inválido: ${percent}.`);
  }

  const result = roundHalfUp((cents * percent) / 100);

  if (!Number.isSafeInteger(result)) {
    throw new RangeError("El porcentaje excede el rango seguro de centavos.");
  }

  return result;
}
