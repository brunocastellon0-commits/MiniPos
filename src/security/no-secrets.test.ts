import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT_DIR = path.resolve(__dirname, "../../");
const SRC_DIR = path.resolve(__dirname, "../../src");

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    // Ignorar carpetas generadas, dependencias y git
    if (
      item === "node_modules" ||
      item === ".git" ||
      item === ".next" ||
      item === "coverage" ||
      item === "dist"
    ) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Security: No Secrets in Repository", () => {
  it(".gitignore ignora todos los archivos .env excepto .env.example", () => {
    const gitignorePath = path.join(ROOT_DIR, ".gitignore");
    const content = fs.readFileSync(gitignorePath, "utf8");

    expect(content).toMatch(/^\.env\*/m);
    expect(content).toMatch(/^!\.env\.example/m);
  });

  it("ningún archivo versionado contiene cadenas secretas de Supabase o service_role", () => {
    const files = getAllFiles(ROOT_DIR).filter(
      (f) =>
        !f.endsWith(".env.local") &&
        !f.endsWith(".png") &&
        !f.endsWith(".ico") &&
        !f.endsWith(".lock") &&
        !f.endsWith("pnpm-lock.yaml") &&
        !f.endsWith("no-secrets.test.ts"),
    );

    const secretPatterns = [
      /sb_secret_[a-zA-Z0-9_\-]+/,
      /service_role\s*[:=]\s*['"][a-zA-Z0-9_\-\.]+['"]/,
    ];

    const violations: { file: string; pattern: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          violations.push({
            file: path.relative(ROOT_DIR, file),
            pattern: pattern.toString(),
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("variables NEXT_PUBLIC_* en src/ solo usan las claves públicas autorizadas", () => {
    const srcFiles = getAllFiles(SRC_DIR).filter(
      (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith("no-secrets.test.ts"),
    );

    const allowedPublicVars = new Set([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]);

    const unauthorizedVars: { file: string; varName: string }[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf8");
      const matches = content.match(/NEXT_PUBLIC_[A-Z0-9_]+/g);
      if (matches) {
        for (const match of matches) {
          if (!allowedPublicVars.has(match)) {
            unauthorizedVars.push({
              file: path.relative(ROOT_DIR, file),
              varName: match,
            });
          }
        }
      }
    }

    expect(unauthorizedVars).toEqual([]);
  });
});
