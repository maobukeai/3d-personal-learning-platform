#!/usr/bin/env node
/* global console, process */
/**
 * UI 治理护栏：禁止新增小于 10px 的字号。
 *
 * design-foundation.md §2 规定正文最小 12px；当前基线已将全站 8px/9px
 * 统一提升到 10px（信息密集的看板/徽章场景的第一步），本脚本确保
 * text-[8px] / text-[9px] 不会回流。接入 npm run lint:strict。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const FORBIDDEN = [/text-\[[1-9]px\]/];

const violations = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(vue|ts)$/.test(entry.name)) continue;
    const content = readFileSync(full, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (FORBIDDEN.some((re) => re.test(line))) {
        violations.push(`${full.replace(ROOT, '')}:${i + 1}`);
      }
    });
  }
};

walk(SRC);

if (violations.length > 0) {
  console.error(`✗ 发现 ${violations.length} 处小于 10px 的字号（design-foundation §2 违规）:`);
  for (const v of violations.slice(0, 20)) console.error(`  ${v}`);
  if (violations.length > 20) console.error(`  ...共 ${violations.length} 处`);
  process.exit(1);
}
console.log('✓ 无小于 10px 的字号');
