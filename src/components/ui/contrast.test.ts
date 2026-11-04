import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`Token --color-${name} no encontrado en globals.css`);
  return match[1];
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function channelLuminance(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

function composite(fg: string, alpha: number, bg: string): string {
  const [fr, fg2, fb] = toRgb(fg);
  const [br, bg2, bb] = toRgb(bg);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hex(mix(fr, br))}${hex(mix(fg2, bg2))}${hex(mix(fb, bb))}`;
}

const AA = 4.5;
const AAA_LARGE = 7;

function expectAA(fg: string, bg: string, label: string, min = AA) {
  const ratio = contrastRatio(fg, bg);
  expect(ratio, `${label}: ${ratio.toFixed(2)}:1 (mínimo ${min}:1)`).toBeGreaterThanOrEqual(min);
}

describe("Contraste AA de los tokens de color (E11-04)", () => {
  const surface = token("surface");
  const surfaceMuted = token("surface-muted");
  const background = token("background");
  const foreground = token("foreground");
  const muted = token("muted");

  it("texto principal y secundario sobre fondos de superficie", () => {
    expectAA(foreground, surface, "foreground/surface", AAA_LARGE);
    expectAA(foreground, surfaceMuted, "foreground/surface-muted", AAA_LARGE);
    expectAA(foreground, background, "foreground/background", AAA_LARGE);
    expectAA(muted, surface, "muted/surface");
    expectAA(muted, surfaceMuted, "muted/surface-muted");
    expectAA(muted, background, "muted/background");
  });

  it("texto sobre botones y estados (pares sólidos)", () => {
    expectAA(token("primary-foreground"), token("primary"), "primary-foreground/primary");
    expectAA(token("primary-foreground"), token("primary-hover"), "primary-foreground/primary-hover");
    expectAA(token("danger-foreground"), token("danger"), "danger-foreground/danger");
    expectAA(token("danger-foreground"), token("danger-hover"), "danger-foreground/danger-hover");
    expectAA(token("success-foreground"), token("success"), "success-foreground/success");
    expectAA(token("warning-foreground"), token("warning"), "warning-foreground/warning");
    expectAA(token("info-foreground"), token("info"), "info-foreground/info");
    expectAA(token("accent-foreground"), token("accent"), "accent-foreground/accent");
  });

  it("texto de estado sobre fondos neutros (toasts, alertas y etiquetas)", () => {
    expectAA(token("danger"), surface, "danger/surface");
    expectAA(token("success"), surface, "success/surface");
    expectAA(token("warning"), surface, "warning/surface");
    expectAA(token("primary"), surface, "primary/surface");
    expectAA(token("danger"), background, "danger/background");
    expectAA(token("success"), background, "success/background");
    expectAA(token("warning"), background, "warning/background");
  });

  it("texto de estado sobre sus fondos translúcidos (tono/10 compuesto)", () => {
    for (const name of ["danger", "success", "warning", "primary", "accent"] as const) {
      const fg = token(name);
      const onWhite = composite(fg, 0.1, surface);
      expectAA(fg, onWhite, `${name} sobre ${name}/10 (sobre surface)`);
      const onBackground = composite(fg, 0.1, background);
      expectAA(fg, onBackground, `${name} sobre ${name}/10 (sobre background)`);
    }
  });

  it("anillo de foco visible (elemento no textual, mínimo 3:1)", () => {
    expectAA(token("ring"), surface, "ring/surface", 3);
    expectAA(token("ring"), background, "ring/background", 3);
    expectAA(token("ring"), surfaceMuted, "ring/surface-muted", 3);
  });
});
