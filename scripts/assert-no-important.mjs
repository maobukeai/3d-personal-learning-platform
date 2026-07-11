#!/usr/bin/env node
/* global console, process */
/**
 * assert-no-important.mjs
 * 零容忍 !important 门禁：扫描 src/ 下所有 .vue 和 .css 文件，
 * 发现任何 !important 即失败。
 *
 * 用法：
 *   node scripts/assert-no-important.mjs            人类可读输出
 *   node scripts/assert-no-important.mjs --json     机器可读 JSON 输出
 *
 * JSON 格式：
 *   { "declarations": <number>, "exceptions": <number>, "files": [...] }
 *
 * 退出码：0 = 通过（无 !important），1 = 失败（发现 !important）
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_DIR = join(ROOT, 'src');

const TARGET_EXTENSIONS = new Set(['.vue', '.css']);

/** Parse CLI args: --json enables machine-readable output. */
const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (TARGET_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function checkFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  const violations = [];

  // Strip CSS/HTML comments before scanning so that !important mentioned
  // in documentation comments is not flagged.
  // Replace comment content with empty string but PRESERVE newlines so that
  // line numbers stay aligned with the original file.
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''))
    // Strip // line comments (only when the line starts with optional whitespace then //)
    .replace(/^[ \t]*\/\/.*$/gm, '');

  const originalLines = content.split('\n');
  const strippedLines = stripped.split('\n');

  // Scan stripped lines for !important, report against original line numbers.
  // Since comment stripping keeps line structure intact (replacing comment
  // content with empty string preserves newlines), line numbers align.
  strippedLines.forEach((line, idx) => {
    if (/!\s*important/i.test(line)) {
      violations.push({ line: idx + 1, content: originalLines[idx] || line });
    }
  });

  return violations;
}

async function main() {
  const files = await walk(SRC_DIR);
  let totalViolations = 0;
  const fileViolations = [];

  for (const file of files) {
    const violations = await checkFile(file);
    if (violations.length > 0) {
      totalViolations += violations.length;
      fileViolations.push({
        file: relative(ROOT, file),
        violations: violations.map((v) => ({ line: v.line, content: v.content.trim() })),
      });
    }
  }

  // exceptions = 0 (no allowlist mechanism yet; reserved for future per-file
  // exception configuration so the JSON contract is stable).
  const exceptions = 0;

  if (JSON_MODE) {
    // Machine-readable JSON: one line, stable schema for CI parsing.
    console.log(
      JSON.stringify({
        declarations: totalViolations,
        exceptions,
        filesScanned: files.length,
        files: fileViolations,
      }),
    );
    process.exit(totalViolations === 0 ? 0 : 1);
  }

  console.log('🔍 Scanning src/ for !important declarations...');

  if (totalViolations === 0) {
    console.log(`✅ PASS: No !important found in ${files.length} files under src/`);
    console.log(`Summary: ${totalViolations} declarations / ${exceptions} exceptions`);
    process.exit(0);
  } else {
    console.error(
      `❌ FAIL: Found ${totalViolations} !important declarations in ${fileViolations.length} files:\n`,
    );
    for (const { file, violations } of fileViolations) {
      console.error(`  ${file}:`);
      for (const v of violations) {
        console.error(`    L${v.line}: ${v.content}`);
      }
      console.error('');
    }
    console.error(`Total: ${totalViolations} !important declarations must be removed.`);
    console.error(`Summary: ${totalViolations} declarations / ${exceptions} exceptions`);
    console.error(
      'See docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md section 2 for migration guide.',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
