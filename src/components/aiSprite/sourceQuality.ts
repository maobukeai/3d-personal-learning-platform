export type EvidenceTier = 'primary' | 'strong' | 'context' | 'weak';

export type MessageSource = {
  title: string;
  link: string;
  domain: string;
  publishedAt?: string;
  evidenceTier?: EvidenceTier;
  evidenceType?: string;
  sourceIndex?: number;
  credibilityScore?: number;
  freshnessLabel?: string;
  dateConfidence?: 'known' | 'unknown';
  qualitySignals?: string[];
};

export type SourceOverview = {
  primary: number;
  strong: number;
  weak: number;
  dated: number;
  domainCount: number;
  highQuality: number;
  averageScore: number;
};

type PulseMessage = {
  mode?: 'default' | 'search' | 'research';
  reasoning?: string;
  isThinking?: boolean;
  sources?: MessageSource[];
};

export const getSourceTierLabel = (source: MessageSource) => {
  if (source.evidenceType) return source.evidenceType;
  if (source.evidenceTier === 'primary') return '一手来源';
  if (source.evidenceTier === 'strong') return '强证据';
  if (source.evidenceTier === 'weak') return '补充';
  return '背景';
};

export const getSourceTierClass = (source: MessageSource) => {
  if (source.evidenceTier === 'primary') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  if (source.evidenceTier === 'strong') {
    return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300';
  }
  if (source.evidenceTier === 'weak') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  }
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300';
};

export const getSourceScoreClass = (score?: number) => {
  if (typeof score !== 'number') {
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300';
  }
  if (score >= 80) {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  if (score >= 65) {
    return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300';
  }
  if (score >= 50) {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  }
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
};

export const getSourceSignalText = (source: MessageSource) => {
  if (source.qualitySignals && source.qualitySignals.length > 0) {
    return source.qualitySignals.slice(0, 2).join(' · ');
  }
  if (source.dateConfidence === 'known') return '日期可识别';
  if (source.freshnessLabel) return source.freshnessLabel;
  return '';
};

export const getSourceOverview = (sources: MessageSource[] = []): SourceOverview => {
  const domains = new Set(sources.map((source) => source.domain).filter(Boolean));
  const primary = sources.filter((source) => source.evidenceTier === 'primary').length;
  const strong = sources.filter((source) => source.evidenceTier === 'strong').length;
  const weak = sources.filter((source) => source.evidenceTier === 'weak').length;
  const dated = sources.filter((source) => Boolean(source.publishedAt)).length;
  const highQuality = sources.filter(
    (source) => typeof source.credibilityScore === 'number' && source.credibilityScore >= 75,
  ).length;
  const scored = sources
    .map((source) => source.credibilityScore)
    .filter((score): score is number => typeof score === 'number');
  const averageScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
      : 0;

  return {
    primary,
    strong,
    weak,
    dated,
    domainCount: domains.size,
    highQuality,
    averageScore,
  };
};

export const getSourceQualityLabel = (sources: MessageSource[] = []) => {
  const overview = getSourceOverview(sources);
  const strongEvidenceCount = overview.primary + overview.strong;
  if (sources.length === 0) return '等待来源';
  return `${strongEvidenceCount} 条强证据 · ${overview.domainCount} 个域名`;
};

export const getResearchPulse = (message: PulseMessage) => {
  const reasoning = message.reasoning || '';
  const searchBatches = (
    reasoning.match(/执行检索|并行检索|多引擎联网搜索|搜索计划已生成|证据审计/g) || []
  ).length;
  const sectionCount = (reasoning.match(/开始研究章节/g) || []).length;
  const qualityAudits = (reasoning.match(/证据质量审计|研究质量审计|引用完整性/g) || []).length;
  const sourceOverview = getSourceOverview(message.sources || []);
  const strongEvidenceCount = sourceOverview.primary + sourceOverview.strong;
  const metrics = [
    {
      label: '检索批次',
      value: searchBatches > 0 ? String(searchBatches) : message.isThinking ? '进行中' : '已完成',
    },
    {
      label: '证据来源',
      value: message.sources?.length ? String(message.sources.length) : '整理中',
    },
    {
      label: '强证据',
      value: strongEvidenceCount > 0 ? String(strongEvidenceCount) : '待筛选',
    },
  ];

  if (message.mode === 'research') {
    metrics.splice(1, 0, {
      label: '研究章节',
      value: sectionCount > 0 ? String(sectionCount) : message.isThinking ? '规划中' : '已汇总',
    });
  }

  if (sourceOverview.averageScore > 0) {
    metrics.push({
      label: '平均可信度',
      value: `${sourceOverview.averageScore}`,
    });
  }

  if (qualityAudits > 0) {
    metrics.push({
      label: '质量审计',
      value: String(qualityAudits),
    });
  }

  return metrics;
};
