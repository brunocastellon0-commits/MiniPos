import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC_DIR = path.resolve(__dirname, "../../src");

function getSourceFiles(dir: string, fileList: string[] = []): string[] {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getSourceFiles(fullPath, fileList);
    } else if (
      (item.endsWith(".ts") || item.endsWith(".tsx")) &&
      !item.endsWith("no-dangerous-html.test.ts")
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Security: No Dangerous HTML or Code Execution", () => {
  it("prohíbe el uso de dangerouslySetInnerHTML en todo el código fuente", () => {
    const files = getSourceFiles(SRC_DIR);
    const violations: { file: string; line: number }[] = [];

    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (line.includes("dangerouslySetInnerHTML")) {
          violations.push({
            file: path.relative(SRC_DIR, file),
            line: index + 1,
          });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("prohíbe el uso de eval() o new Function() en el código fuente", () => {
    const files = getSourceFiles(SRC_DIR);
    const violations: { file: string; match: string }[] = [];

    const dangerousPatterns = [/\beval\s*\(/, /new\s+Function\s*\(/];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          violations.push({
            file: path.relative(SRC_DIR, file),
            match: pattern.toString(),
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
