import path from 'path';
import unzipper from 'unzipper';
import { AppError } from '../utils/error';
import type {
  ParsedTutorialPackage,
  TutorialParameter,
  TutorialSectionInput,
} from './tutorial-package.types';

const MAX_ENTRIES = 1000;
const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const entrySize = (entry: unzipper.File): number =>
  Number(
    (entry as unknown as { vars?: { uncompressedSize?: number } }).vars?.uncompressedSize || 0,
  );

const finiteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const parameterList = (value: unknown): TutorialParameter[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({ name: String(item.name ?? ''), value: String(item.value ?? '') }))
        .filter((item) => item.name.length > 0)
    : [];

const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/^\.\//, '');

const isSafePath = (value: string): boolean => {
  const normalized = normalizePath(value);
  return (
    normalized.length > 0 &&
    !normalized.startsWith('/') &&
    !/^[a-zA-Z]:\//.test(normalized) &&
    !normalized.split('/').includes('..')
  );
};

const sourceBasename = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return path.posix.basename(value.replace(/\\/g, '/'));
};

const selectImageEntry = (
  step: Record<string, unknown>,
  globalIndex: number,
  imageEntries: Map<string, string>,
): string | undefined => {
  const candidates = step.candidates as Record<string, unknown> | undefined;
  const sequence = String(globalIndex + 1).padStart(2, '0');
  const preferred = [
    sourceBasename(step.image),
    sourceBasename(candidates?.end),
    sourceBasename(candidates?.mid),
    sourceBasename(candidates?.start),
    `step_${sequence}_end.png`,
    `step_${sequence}_mid.png`,
    `step_${sequence}_start.png`,
  ];
  for (const filename of preferred) {
    if (!filename) continue;
    const found = imageEntries.get(filename.toLowerCase());
    if (found) return found;
  }
  return undefined;
};

export async function parseTutorialPackage(zipBuffer: Buffer): Promise<ParsedTutorialPackage> {
  let directory: unzipper.CentralDirectory;
  try {
    directory = await unzipper.Open.buffer(zipBuffer);
  } catch {
    throw new AppError('无法打开 ZIP，请确认文件未损坏', 400, 'INVALID_TUTORIAL_ZIP');
  }

  const entries = directory.files.filter((entry) => entry.type !== 'Directory');
  if (entries.length === 0 || entries.length > MAX_ENTRIES) {
    throw new AppError('ZIP 文件数量异常', 400, 'UNSAFE_TUTORIAL_ZIP');
  }
  let totalSize = 0;
  for (const entry of entries) {
    if (!isSafePath(entry.path)) {
      throw new AppError('ZIP 包含不安全路径', 400, 'UNSAFE_TUTORIAL_ZIP');
    }
    totalSize += entrySize(entry);
  }
  if (totalSize > MAX_UNCOMPRESSED_BYTES) {
    throw new AppError('ZIP 解压后体积超过 500MB', 400, 'TUTORIAL_ZIP_TOO_LARGE');
  }

  const jsonEntries = entries.filter((entry) => /(^|\/)tutorial\.json$/i.test(entry.path));
  if (jsonEntries.length !== 1) {
    throw new AppError('每个 ZIP 必须且只能包含一个 tutorial.json', 400, 'TUTORIAL_JSON_REQUIRED');
  }
  const jsonEntry = jsonEntries[0]!;
  if (entrySize(jsonEntry) > MAX_JSON_BYTES) {
    throw new AppError('tutorial.json 体积异常', 400, 'TUTORIAL_JSON_TOO_LARGE');
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse((await jsonEntry.buffer()).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new AppError('tutorial.json 不是有效 JSON', 400, 'INVALID_TUTORIAL_JSON');
  }
  if (!Array.isArray(raw.chapters) || raw.chapters.length === 0) {
    throw new AppError('tutorial.json 缺少 chapters', 400, 'INVALID_TUTORIAL_JSON');
  }

  const imageEntries = new Map<string, string>();
  for (const entry of entries) {
    if (!/\.(png|jpe?g|webp)$/i.test(entry.path)) continue;
    if (entrySize(entry) > MAX_IMAGE_BYTES) continue;
    imageEntries.set(path.posix.basename(normalizePath(entry.path)).toLowerCase(), entry.path);
  }

  let globalStepIndex = 0;
  const sections: TutorialSectionInput[] = raw.chapters.map((chapterValue, chapterIndex) => {
    const chapter = (chapterValue || {}) as Record<string, unknown>;
    const rawSteps = Array.isArray(chapter.steps) ? chapter.steps : [];
    const steps = rawSteps.map((stepValue, stepIndex) => {
      const step = (stepValue || {}) as Record<string, unknown>;
      const imageEntry = selectImageEntry(step, globalStepIndex, imageEntries);
      globalStepIndex += 1;
      return {
        order: finiteNumber(step.order, stepIndex + 1),
        title: String(step.title || `步骤 ${stepIndex + 1}`),
        description: String(step.description || ''),
        startTime: finiteNumber(step.startTime),
        endTime: finiteNumber(step.endTime),
        screenshotTime:
          step.screenshotTime === undefined ? undefined : finiteNumber(step.screenshotTime),
        shortcuts: stringList(step.shortcuts),
        parameters: parameterList(step.parameters),
        warnings: stringList(step.warnings),
        imageEntry,
      };
    });
    return {
      order: chapterIndex + 1,
      title: String(chapter.title || `分组 ${chapterIndex + 1}`),
      startTime: finiteNumber(chapter.startTime),
      endTime: finiteNumber(chapter.endTime),
      steps,
    };
  });

  const rootName = normalizePath(jsonEntry.path)
    .split('/')
    .at(-2)
    ?.replace(/_tutorial$/i, '');
  return {
    title: rootName || String(raw.title || '导入章节'),
    summary: String(raw.summary || ''),
    sections,
    async getEntryBuffer(entryPath: string) {
      const entry = entries.find((candidate) => candidate.path === entryPath);
      if (!entry) throw new AppError('参考图不存在', 400, 'TUTORIAL_IMAGE_MISSING');
      return entry.buffer();
    },
  };
}
