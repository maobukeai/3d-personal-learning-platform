import { callLLM, type AIServiceConfig } from './ai.service';
import { DEEP_RESEARCH_REPORTING_RULES } from '../config/prompts';
import {
  assessSearchResultQuality,
  fetchAshareMarketSnapshot,
  formatSearchResultsAsPrompt,
  performWebSearch,
  type SearchResult,
  type SearchEvidenceTier,
  type WebSearchOptions,
} from './search.service';

export interface DeepResearchContext {
  queries: string[];
  sources: SearchResult[];
  groundingPrompt: string;
}

export interface ResearchSection {
  title: string;
  description: string;
}

export interface ResearchOutline {
  sections: ResearchSection[];
}

interface TemporalContext {
  today: string;
  nextWeekRange: string;
  isTimeSensitive: boolean;
  isMarketForecast: boolean;
  isTechnicalTooling: boolean;
  recencyDays: number;
  answerRules: string;
  trustedFreshDomains: string[];
}

interface RankedSearchResult extends SearchResult {
  score: number;
  ageDays: number | null;
  usable: boolean;
  evidenceTier: EvidenceTier;
  evidenceType: string;
}

interface ResearchSourceRef {
  index: number;
  source: SearchResult;
}

type ProgressReporter = (update: string) => void;
type EvidenceTier = SearchEvidenceTier;

const EVIDENCE_SOURCE_LIMIT = 28;
const MARKET_EVIDENCE_SOURCE_LIMIT = 32;
const MAX_FUTURE_SOURCE_DAYS = 7;

function readBoundedInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const MAX_RESEARCH_SECTIONS = readBoundedInt('DEEP_RESEARCH_MAX_SECTIONS', 5, 1, 6);
const RESEARCH_MAX_DEPTH = readBoundedInt('DEEP_RESEARCH_MAX_DEPTH', 2, 1, 4);
const QUERIES_PER_DEPTH = readBoundedInt('DEEP_RESEARCH_QUERIES_PER_DEPTH', 3, 1, 4);
const MARKET_QUERIES_PER_DEPTH = readBoundedInt('DEEP_RESEARCH_MARKET_QUERIES_PER_DEPTH', 5, 2, 8);

const TRUSTED_MARKET_DOMAINS = [
  'eastmoney.com',
  'finance.eastmoney.com',
  'data.eastmoney.com',
  'quote.eastmoney.com',
  'finance.sina.com.cn',
  'stock.finance.sina.com.cn',
  '10jqka.com.cn',
  'stock.10jqka.com.cn',
  'cninfo.com.cn',
  'sse.com.cn',
  'szse.cn',
  'csrc.gov.cn',
  'pbc.gov.cn',
  'stats.gov.cn',
  'mof.gov.cn',
  'csindex.com.cn',
  'stcn.com',
  'cnstock.com',
  'cs.com.cn',
  'zqrb.cn',
  'cls.cn',
  'wallstreetcn.com',
  'finance.yahoo.com',
  'marketwatch.com',
  'nasdaq.com',
  'cnbc.com',
  'investing.com',
  'tradingeconomics.com',
  'reuters.com',
  'bloomberg.com',
  'federalreserve.gov',
  'sec.gov',
  'bls.gov',
  'bea.gov',
  'cmegroup.com',
];

const ROUND1_SEARCH_OPTIONS: WebSearchOptions = {
  maxResults: 14,
  includePageContent: true,
  pageContentLength: 4200,
  maxSearchEngines: 7,
  enableFallbackSearch: true,
  alwaysRunFallbackSearch: true,
};

function reportProgress(onProgress: ProgressReporter | undefined, update: string): void {
  onProgress?.(`${update}\n`);
}

function getPlatformToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getNextWeekRange(today: string): string {
  const todayDate = new Date(`${today}T12:00:00+08:00`);
  const day = todayDate.getUTCDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  const start = addDays(todayDate, daysUntilNextMonday);
  const end = addDays(start, 6);
  return `${formatDate(start)} to ${formatDate(end)}`;
}

function cleanQueryLine(value: string): string {
  return value
    .replace(/^\d+[\).\s-]*/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectTemporalContext(userPrompt: string): TemporalContext {
  const today = getPlatformToday();
  const nextWeekRange = getNextWeekRange(today);
  const isTimeSensitive =
    /(今天|明天|昨天|本周|这周|下周|下个月|近期|最近|最新|走势|预测|展望|today|tomorrow|yesterday|this week|next week|latest|recent|forecast|outlook)/i.test(
      userPrompt,
    );
  const isMarketForecast =
    /(股市|股票|a股|港股|美股|纳指|纳斯达克|标普|道指|沪深|大盘|指数|行情|走势|财报|降息|加息|market|stock|nasdaq|s&p|dow|equity|earnings|fomc|fed)/i.test(
      userPrompt,
    );
  const isTechnicalTooling =
    /(工具|开源|项目|框架|库|插件|agent|github|开源项目|技术选型|竞品|benchmark|open source|tool|framework|library|plugin|sdk|api|implementation|architecture)/i.test(
      userPrompt,
    );
  const recencyDays = isMarketForecast ? 10 : isTimeSensitive ? 30 : 0;

  const answerRules = [
    `Today is ${today} in Asia/Shanghai.`,
    `If the user says "next week", interpret it as ${nextWeekRange}.`,
    isTimeSensitive
      ? `This is time-sensitive. Use sources from the last ${recencyDays} days when possible; older sources are background only.`
      : 'This request is not strongly time-sensitive unless the user says otherwise.',
    isMarketForecast
      ? [
          'This is a financial market outlook request.',
          'Use only fresh evidence or trusted live/official market sources.',
          'Never present old forecasts or forum posts as current evidence.',
          'Avoid personalized investment advice and guaranteed predictions.',
        ].join(' ')
      : '',
    isTechnicalTooling
      ? [
          'This request involves technical tooling, open-source projects, or implementation decisions.',
          'Prefer official docs, source repositories, release notes, benchmarks, issue trackers, and credible engineering writeups.',
          'When recommending adoption, include integration cost, maintenance risk, license/hosting concerns, and a practical rollout plan.',
        ].join(' ')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    today,
    nextWeekRange,
    isTimeSensitive,
    isMarketForecast,
    isTechnicalTooling,
    recencyDays,
    answerRules,
    trustedFreshDomains: isMarketForecast ? TRUSTED_MARKET_DOMAINS : [],
  };
}

function extractJsonBlock(text: string): string {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

function parseJsonObject<T extends object>(raw: string): Partial<T> {
  try {
    const parsed = JSON.parse(extractJsonBlock(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const query of queries) {
    const cleaned = cleanQueryLine(query);
    const normalized = cleaned.toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(cleaned);
  }

  return deduped;
}

function buildDeterministicSectionQueries(
  userPrompt: string,
  section: ResearchSection,
  temporalContext: TemporalContext,
): string[] {
  const base = cleanQueryLine(userPrompt);
  const sectionTopic = cleanQueryLine(`${section.title} ${section.description}`).slice(0, 120);
  const queries = [base, `${base} ${section.title}`, sectionTopic];

  if (temporalContext.isMarketForecast) {
    const sectionText = `${section.title} ${section.description}`.toLowerCase();
    const marketQueries = [
      `${base} ${section.title} 最新 A股 下周 走势 机构观点`,
      `site:eastmoney.com ${base} A股 下周 走势`,
    ];

    if (/宏观|政策|流动性|外部|利率|汇率|经济|pmi|cpi|外资|资金/.test(sectionText)) {
      marketQueries.push(
        `site:pbc.gov.cn 货币政策 流动性 最新`,
        `site:stats.gov.cn PMI CPI 工业增加值 最新`,
        `site:csrc.gov.cn 证监会 最新 政策 市场`,
        `site:mof.gov.cn 财政政策 A股 市场 最新`,
      );
    } else if (/技术|指数|行情|量能|成交|北向|融资|资金面|板块|行业/.test(sectionText)) {
      marketQueries.push(
        `site:quote.eastmoney.com 上证指数 深证成指 创业板指 最新 行情`,
        `site:finance.sina.com.cn A股 指数 技术面 资金面`,
        `site:10jqka.com.cn A股 板块 资金 流向`,
        `site:csindex.com.cn 中证 指数 A股 最新`,
      );
    } else {
      marketQueries.push(
        `site:stcn.com ${base} A股 下周 市场`,
        `site:cnstock.com ${base} A股 展望`,
        `site:cs.com.cn ${base} 市场 分析 A股`,
        `site:zqrb.cn ${base} A股 市场 展望`,
      );
    }

    queries.push(
      ...marketQueries,
      `site:sse.com.cn A股 市场 数据 最新`,
      `site:szse.cn A股 市场 数据 最新`,
      `site:cninfo.com.cn A股 公告 业绩 最新`,
    );
  }

  if (temporalContext.isTechnicalTooling) {
    queries.push(
      `${base} open source GitHub comparison`,
      `${base} architecture implementation best practices`,
      `${base} alternatives benchmarks limitations`,
      `site:github.com ${base}`,
      `site:docs.github.com OR site:github.com ${base} release notes`,
    );
  }

  return dedupeQueries(queries);
}

function normalizeSourceKey(source: SearchResult): string {
  try {
    const url = new URL(source.link);
    url.hash = '';
    url.searchParams.sort();
    return url.toString().toLowerCase();
  } catch {
    return source.link.trim().toLowerCase();
  }
}

function dedupeSources(sources: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const source of sources) {
    const key = normalizeSourceKey(source);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }

  return deduped;
}

function getSourceAgeDays(source: SearchResult, today: string): number | null {
  if (!source.publishedAt) return null;

  const publishedTime = new Date(source.publishedAt).getTime();
  const todayTime = new Date(`${today}T23:59:59+08:00`).getTime();
  if (Number.isNaN(publishedTime) || Number.isNaN(todayTime)) return null;

  return Math.floor((todayTime - publishedTime) / (24 * 60 * 60 * 1000));
}

function isDomainMatch(domain: string, candidates: string[]): boolean {
  const normalizedDomain = domain.toLowerCase();
  return candidates.some((candidate) => {
    const normalizedCandidate = candidate.toLowerCase();
    return (
      normalizedDomain === normalizedCandidate ||
      normalizedDomain.endsWith(`.${normalizedCandidate}`)
    );
  });
}

function isTrustedMarketSource(source: SearchResult): boolean {
  return isDomainMatch(source.domain || '', TRUSTED_MARKET_DOMAINS);
}

function isSupplementalSource(source: SearchResult): boolean {
  return isDomainMatch(source.domain || '', [
    'xueqiu.com',
    'youtube.com',
    'bilibili.com',
    'reddit.com',
    'zhihu.com',
    'tieba.baidu.com',
    'medium.com',
    'x.com',
    'twitter.com',
  ]);
}

function classifyEvidenceSource(source: SearchResult): {
  evidenceTier: EvidenceTier;
  evidenceType: string;
  scoreBoost: number;
} {
  const quality = assessSearchResultQuality(source);
  const scoreBoost =
    quality.evidenceTier === 'primary'
      ? 8
      : quality.evidenceTier === 'strong'
        ? 4
        : quality.evidenceTier === 'weak'
          ? -5
          : 0;

  return {
    evidenceTier: quality.evidenceTier,
    evidenceType: quality.evidenceType,
    scoreBoost,
  };
}

function isUsableEvidenceSource(source: SearchResult, temporalContext: TemporalContext): boolean {
  if (!source.title || !source.link) return false;
  if (!temporalContext.isTimeSensitive) return true;

  const ageDays = getSourceAgeDays(source, temporalContext.today);
  if (ageDays !== null) {
    return ageDays >= -MAX_FUTURE_SOURCE_DAYS && ageDays <= temporalContext.recencyDays;
  }

  // Undated ordinary pages are the main cause of stale "next week" answers.
  if (temporalContext.isMarketForecast) {
    return isTrustedMarketSource(source);
  }

  return false;
}

function scoreSource(source: SearchResult, temporalContext: TemporalContext): RankedSearchResult {
  const domain = (source.domain || '').toLowerCase();
  const quality = assessSearchResultQuality(source, {
    today: temporalContext.today,
    recencyDays: temporalContext.recencyDays,
    requireFreshness: temporalContext.isTimeSensitive,
    trustedFreshDomains: temporalContext.trustedFreshDomains,
  });
  const ageDays = quality.ageDays;
  const textLength = (source.content || source.snippet || '').length;
  const usable = isUsableEvidenceSource(source, temporalContext);
  const evidence = {
    evidenceTier: quality.evidenceTier,
    evidenceType: quality.evidenceType,
    scoreBoost: quality.evidenceTier === 'primary' ? 8 : quality.evidenceTier === 'strong' ? 4 : 0,
  };
  let score = usable ? quality.credibilityScore : quality.credibilityScore - 55;

  if (source.title) score += 2;
  if (source.snippet) score += 2;
  if (source.content) score += 4;
  if (textLength > 700) score += 2;
  score += evidence.scoreBoost;
  if (isTrustedMarketSource(source)) score += 6;
  if (domain.includes('gov') || domain.includes('edu')) score += 3;
  if (isSupplementalSource(source)) score -= temporalContext.isMarketForecast ? 8 : 4;

  if (temporalContext.isTimeSensitive) {
    if (ageDays === null) score -= temporalContext.isMarketForecast ? 4 : 8;
    else if (ageDays >= -MAX_FUTURE_SOURCE_DAYS && ageDays <= 2) score += 8;
    else if (ageDays <= temporalContext.recencyDays) score += 4;
    else score -= 25;
  }

  return { ...source, score, ageDays, usable, ...evidence };
}

function rankSources(
  sources: SearchResult[],
  temporalContext: TemporalContext,
): RankedSearchResult[] {
  return dedupeSources(sources)
    .map((source) => scoreSource(source, temporalContext))
    .sort((a, b) => b.score - a.score);
}

function selectEvidenceSources(
  rankedSources: RankedSearchResult[],
  temporalContext: TemporalContext,
): SearchResult[] {
  const limit = temporalContext.isMarketForecast
    ? MARKET_EVIDENCE_SOURCE_LIMIT
    : EVIDENCE_SOURCE_LIMIT;
  const perDomainLimit = temporalContext.isMarketForecast ? 3 : 4;
  const supplementalLimit = temporalContext.isMarketForecast ? 3 : 6;
  const selected: RankedSearchResult[] = [];
  const domainCounts = new Map<string, number>();
  let supplementalCount = 0;

  for (const source of rankedSources) {
    if (!source.usable) continue;

    const domain = (source.domain || 'unknown').toLowerCase();
    const currentDomainCount = domainCounts.get(domain) || 0;
    const supplemental = isSupplementalSource(source);

    if (currentDomainCount >= perDomainLimit) continue;
    if (supplemental && supplementalCount >= supplementalLimit) continue;

    selected.push(source);
    domainCounts.set(domain, currentDomainCount + 1);
    if (supplemental) supplementalCount += 1;

    if (selected.length >= limit) break;
  }

  // If strict domain diversity leaves the report too thin, relax only the domain cap.
  if (selected.length < Math.min(10, limit)) {
    const selectedKeys = new Set(selected.map((source) => normalizeSourceKey(source)));
    for (const source of rankedSources) {
      if (!source.usable || selectedKeys.has(normalizeSourceKey(source))) continue;
      if (isSupplementalSource(source) && supplementalCount >= supplementalLimit) continue;

      selected.push(source);
      selectedKeys.add(normalizeSourceKey(source));
      if (isSupplementalSource(source)) supplementalCount += 1;

      if (selected.length >= limit) break;
    }
  }

  return selected;
}

const OUTLINE_PLANNER_PROMPT = `You are a lead research director designing a premium deep-research workflow.
Analyze the user's research question and outline a structured research plan.
Divide the topic into 4 to {{MAX_SECTIONS}} distinct, logical sections/sub-topics when the topic is broad. For narrow questions, use fewer sections only if it improves precision.

Current Date: {{TODAY}}
User Question: {{USER_PROMPT}}

Planning principles:
1. Cover the direct answer, background/definitions, latest evidence, competing viewpoints, risks/limitations, and practical implications.
2. Prefer sections that can be independently verified by web evidence.
3. For technical/tooling questions, include ecosystem comparison, implementation feasibility, and adoption risks.
4. For time-sensitive questions, make recency and source credibility explicit.
5. For product/tool improvement questions, include market-standard patterns, open-source projects worth learning from, integration architecture, and measurable upgrade outcomes.

Return the plan strictly as a JSON object matching this TypeScript interface:
{
  "sections": [
    {
      "title": "Short descriptive title of this section",
      "description": "What specific information or questions need to be answered in this section"
    }
  ]
}
Do not return any extra explanations or Markdown code fences. Output ONLY valid JSON.`;

const SECTION_QUERY_PROPOSAL_PROMPT = `You are a search query planner. You are researching a specific section of a larger report.
Section: {{SECTION_TITLE}}
Section Goal: {{SECTION_DESC}}

Already Gathered Findings for this section so far:
{{GATHERED_INFO}}

Based on the goal and what has already been found, propose 3 short, highly specific search queries (in English or Chinese as appropriate) to find missing details, primary sources, opposing views, implementation evidence, or verification evidence for this section.
For technical/open-source research, include queries that can surface GitHub repositories, official docs, release notes, benchmarks, architecture writeups, license constraints, and real adoption concerns.
Return the result strictly as a JSON object matching:
{
  "queries": ["query 1", "query 2", "query 3"]
}
Do not return any extra explanations or Markdown code fences. Output ONLY valid JSON.`;

const SECTION_FINDINGS_EXTRACTOR_PROMPT = `You are an expert information extractor. You are researching the section: "{{SECTION_TITLE}}".
Section Goal: "{{SECTION_DESC}}"

Here are evidence blocks scraped from recent search results. Each block has a stable global citation id such as [7].
---
{{EVIDENCE_BLOCKS}}
---

Already Gathered Findings:
{{PREVIOUS_FINDINGS}}

Your tasks:
1. Extract new facts, statistics, dates, and evidence relevant to the section goal from the scraped text.
2. Synthesize these new facts with the Already Gathered Findings.
3. Separate strong evidence from weak/dated/ambiguous evidence.
4. Identify any remaining information gaps or unanswered questions for this section.
5. When stating a fact derived from a source, you MUST cite it using only the global citation id shown in the evidence block, like [1], [2], etc.
6. Do not cite a source id that is not present in the evidence blocks. Do not invent citations.
7. Preserve concrete numbers, dates, names, limitations, and contrasting viewpoints.
8. For tools, products, libraries, or open-source projects, extract adoption signals, integration paths, maturity risks, license/deployment constraints, and UX/product ideas that can be translated into this platform.

Return the result strictly as a JSON object matching this format:
{
  "findings": "A detailed synthesis of all findings so far for this section, incorporating inline citations [1], [2] where appropriate. Include evidence strength, concrete facts, implementation details, decision implications, and any disagreement between sources.",
  "gaps": "Any remaining unresolved questions or gaps in information that still need to be researched. If everything is answered or no new queries are useful, return an empty string."
}
Do not return any extra explanations or Markdown code fences. Output ONLY valid JSON.`;

const FINAL_COMPILER_PROMPT = `You are a lead editor compiling a comprehensive research report.
User Question: {{USER_PROMPT}}

Here are the section drafts generated by our research team:
{{SECTION_DRAFTS}}

Temporal Context rules:
{{TEMPORAL_RULES}}

Compile these drafts into a single, cohesive, highly detailed research report.
Rules:
1. Do not lose any factual details, dates, statistics, or citations. Keep the inline citations like [1], [2] exactly as they are.
2. Structure the report with a premium analyst format:
   - 一句话结论 / One-line Answer
   - 结论摘要 / Executive Summary
   - 证据地图 / Evidence Map
   - 分章节深度分析 / Detailed Analysis
   - 标杆工具/开源项目借鉴清单 / Benchmark Tools and Open-Source Inspirations
   - 对比矩阵 / Comparison Matrix
   - 落地蓝图 / Implementation Blueprint
   - 争议、反例与不确定性 / Counterpoints and Uncertainty
   - 行动建议 / Recommended Actions
   - 参考来源 / Sources Used
3. Ensure the tone is objective, analytical, and professional.
4. Do not invent any new facts or citations.
5. Do not output citation-only paragraphs, bare numbers, or orphaned source ids. Each citation must support a nearby factual sentence.
6. If the research user question is in Chinese, write the entire report in Chinese.
7. The Evidence Map should be compact and useful: list 5-10 strongest evidence points, their source ids, and what they prove.
8. Recommended Actions must be specific, prioritized, and acknowledge constraints revealed by the evidence.
9. For technical/tooling/product upgrade questions, the Comparison Matrix must compare practical options by capability, integration cost, maturity, risk, and expected user value.
10. For product/tool improvement questions, the Benchmark Tools and Open-Source Inspirations section must list each project/tool, what capability is worth learning from, how it could be adapted into this platform, what cannot be copied directly, and what validation is needed.
11. The Implementation Blueprint must translate the research into a staged product/engineering plan: quick wins, core upgrade, validation metrics, and follow-up experiments.`;

async function planResearchOutline(
  userPrompt: string,
  temporalContext: TemporalContext,
  overrides?: Partial<AIServiceConfig>,
): Promise<ResearchOutline> {
  const prompt = OUTLINE_PLANNER_PROMPT.replace('{{MAX_SECTIONS}}', String(MAX_RESEARCH_SECTIONS))
    .replace('{{TODAY}}', temporalContext.today)
    .replace('{{USER_PROMPT}}', userPrompt);

  try {
    const raw = await callLLM(prompt, 'You are a research planning agent.', overrides, 90_000);
    const parsed = parseJsonObject<ResearchOutline>(raw);
    if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
      return {
        sections: parsed.sections.slice(0, MAX_RESEARCH_SECTIONS),
      };
    }
  } catch (error) {
    console.error(
      '[Deep Research] Failed to generate outline, falling back to default outline.',
      error,
    );
  }

  // Fallback default outline if planner fails
  return {
    sections: [
      {
        title: '基础事实与背景检索',
        description: `检索并汇总关于"${userPrompt}"的核心事实、最新动态和背景信息。`,
      },
      {
        title: '深度细节与关联要素分析',
        description: `针对"${userPrompt}"的关键数据点、影响因素和深层机制进行详实挖掘。`,
      },
      {
        title: '综合影响与趋势预测评估',
        description: `梳理"${userPrompt}"的潜在风险、多方观点对比及未来演变趋势。`,
      },
    ],
  };
}

async function runSearchBatch(
  queries: string[],
  options: WebSearchOptions,
): Promise<SearchResult[]> {
  const runs = await Promise.allSettled(queries.map((query) => performWebSearch(query, options)));
  return runs.flatMap((run) => (run.status === 'fulfilled' ? run.value : []));
}

function buildSearchOptions(
  baseOptions: WebSearchOptions,
  temporalContext: TemporalContext,
): WebSearchOptions {
  return {
    ...baseOptions,
    recencyDays: temporalContext.recencyDays,
    requireFreshness: temporalContext.isTimeSensitive,
    trustedFreshDomains: temporalContext.trustedFreshDomains,
  };
}

function buildFreshnessAudit(
  rankedSources: RankedSearchResult[],
  temporalContext: TemporalContext,
): string {
  if (!temporalContext.isTimeSensitive) return 'Freshness audit: not required for this request.';

  const lines = rankedSources.slice(0, 12).map((source, index) => {
    const freshness =
      source.ageDays === null
        ? 'unknown date'
        : source.ageDays <= temporalContext.recencyDays
          ? `fresh (${source.ageDays} days old)`
          : `stale (${source.ageDays} days old)`;
    return `[${index + 1}] ${source.usable ? 'usable' : 'rejected'} / ${freshness}: ${source.title}`;
  });

  return `Freshness audit:\n${lines.join('\n') || 'No sources.'}`;
}

function buildEvidenceSelectionSummary(
  selectedEvidence: SearchResult[],
  rankedSources: RankedSearchResult[],
  temporalContext: TemporalContext,
): string {
  const qualities = selectedEvidence.map((source) =>
    assessSearchResultQuality(source, {
      today: temporalContext.today,
      recencyDays: temporalContext.recencyDays,
      requireFreshness: temporalContext.isTimeSensitive,
      trustedFreshDomains: temporalContext.trustedFreshDomains,
    }),
  );
  const domains = new Set(selectedEvidence.map((source) => source.domain).filter(Boolean));
  const strongEvidence = qualities.filter(
    (quality) => quality.evidenceTier === 'primary' || quality.evidenceTier === 'strong',
  ).length;
  const dated = qualities.filter((quality) => quality.dateConfidence === 'known').length;
  const averageScore =
    qualities.length > 0
      ? Math.round(
          qualities.reduce((sum, quality) => sum + quality.credibilityScore, 0) / qualities.length,
        )
      : 0;
  const rejected = rankedSources.filter((source) => !source.usable).length;

  return `证据审计：${strongEvidence} 条一手/强证据，${domains.size} 个独立域名，${dated} 条日期可识别，平均可信度 ${averageScore}/100，过滤 ${rejected} 条低时效或低可用来源。`;
}

function buildResearchQualityAudit(
  sources: SearchResult[],
  temporalContext: TemporalContext,
): string {
  const qualities = sources.map((source) =>
    assessSearchResultQuality(source, {
      today: temporalContext.today,
      recencyDays: temporalContext.recencyDays,
      requireFreshness: temporalContext.isTimeSensitive,
      trustedFreshDomains: temporalContext.trustedFreshDomains,
    }),
  );
  const domains = new Set(sources.map((source) => source.domain).filter(Boolean));
  const primary = qualities.filter((quality) => quality.evidenceTier === 'primary').length;
  const strong = qualities.filter((quality) => quality.evidenceTier === 'strong').length;
  const weak = qualities.filter((quality) => quality.evidenceTier === 'weak').length;
  const dated = qualities.filter((quality) => quality.dateConfidence === 'known').length;
  const averageScore =
    qualities.length > 0
      ? Math.round(
          qualities.reduce((sum, quality) => sum + quality.credibilityScore, 0) / qualities.length,
        )
      : 0;

  return `【研究质量审计】
来源总数：${sources.length}
独立域名：${domains.size}
一手/官方来源：${primary}
强证据来源：${strong}
弱证据/社区补充：${weak}
已识别日期：${dated}
平均可信度：${averageScore}/100
时效要求：${
    temporalContext.isTimeSensitive
      ? `必须优先使用最近 ${temporalContext.recencyDays} 天内或可信实时来源`
      : '不强制最新，但需要优先权威来源、完整正文和交叉验证'
  }`;
}

function registerEvidenceSources(
  selectedEvidence: SearchResult[],
  globalSources: SearchResult[],
  sourceIndexMap: Map<string, number>,
): ResearchSourceRef[] {
  return selectedEvidence.map((source) => {
    const key = normalizeSourceKey(source);
    let index = sourceIndexMap.get(key);
    if (index === undefined) {
      index = globalSources.length + 1;
      globalSources.push(source);
      sourceIndexMap.set(key, index);
    }

    return { index, source };
  });
}

function formatEvidenceBlocks(sourceRefs: ResearchSourceRef[]): string {
  if (sourceRefs.length === 0) {
    return '';
  }

  return sourceRefs
    .map(({ index, source }) => {
      const evidence = classifyEvidenceSource(source);
      const lines = [
        `[${index}] ${source.title}`,
        `URL: ${source.link}`,
        `Domain: ${source.domain || 'unknown'}`,
        `Evidence: ${evidence.evidenceTier} / ${evidence.evidenceType}`,
        source.publishedAt ? `Published: ${source.publishedAt.slice(0, 10)}` : 'Published: unknown',
        `Summary: ${source.snippet || 'No summary available.'}`,
      ];

      if (source.content) {
        lines.push(`Excerpt: ${source.content}`);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

function buildCitationIntegrityAudit(report: string, sourceCount: number): string {
  const citedIds = [...report.matchAll(/\[(\d+)\]/g)]
    .map((match) => Number.parseInt(match[1] || '', 10))
    .filter(Number.isFinite);

  const uniqueCitedIds = [...new Set(citedIds)].sort((a, b) => a - b);
  const unsupportedIds = uniqueCitedIds.filter((id) => id < 1 || id > sourceCount);

  if (uniqueCitedIds.length === 0) {
    return 'Citation integrity audit: no inline citations were present in the research draft. The final answer must cite final evidence sources where factual claims are made.';
  }

  if (unsupportedIds.length > 0) {
    return `Citation integrity audit: unsupported citation ids detected and must not be used in the final answer: ${unsupportedIds
      .map((id) => `[${id}]`)
      .join(', ')}. Valid citation range is [1] to [${sourceCount}].`;
  }

  return `Citation integrity audit: all inline citations in the research draft refer to valid final evidence sources. Cited sources: ${uniqueCitedIds
    .map((id) => `[${id}]`)
    .join(', ')}.`;
}

function buildTraceSection(
  queries: string[],
  evidenceSources: SearchResult[],
  temporalContext: TemporalContext,
): string {
  const queryLines = queries.map((query, index) => `${index + 1}. ${query}`).join('\n');
  const sourceLines = evidenceSources
    .map((source, index) => {
      const ageDays = getSourceAgeDays(source, temporalContext.today);
      const freshness = ageDays === null ? 'date unknown' : `${ageDays} days old`;
      const evidence = classifyEvidenceSource(source);
      return `[${index + 1}] ${source.title} - ${source.link} (${freshness}; ${evidence.evidenceTier}; ${evidence.evidenceType})`;
    })
    .join('\n');

  return `【深度研究过程追踪】
当前日期：${temporalContext.today}
下周范围：${temporalContext.nextWeekRange}

检索词：
${queryLines || '无'}

最终证据源：
${sourceLines || '无'}`;
}

async function researchSection(
  userPrompt: string,
  section: ResearchSection,
  temporalContext: TemporalContext,
  globalSources: SearchResult[],
  sourceIndexMap: Map<string, number>,
  overrides?: Partial<AIServiceConfig>,
  onProgress?: ProgressReporter,
): Promise<{ draft: string; queriesUsed: string[] }> {
  let depth = 1;
  const maxDepth = RESEARCH_MAX_DEPTH;
  const queriesPerDepth = temporalContext.isMarketForecast
    ? MARKET_QUERIES_PER_DEPTH
    : QUERIES_PER_DEPTH;
  let gatheredFindings = 'No findings gathered yet.';
  let gaps = `Find facts and compile evidence to satisfy this objective: ${section.description}`;
  const queriesUsed: string[] = [];

  const searchOptions = buildSearchOptions(ROUND1_SEARCH_OPTIONS, temporalContext);

  while (depth <= maxDepth && gaps.trim().length > 0) {
    reportProgress(onProgress, `  [Depth ${depth}] 正在为章节【${section.title}】规划研究方向...`);

    // 1. Propose targeted queries
    const proposalPrompt = SECTION_QUERY_PROPOSAL_PROMPT.replace('{{SECTION_TITLE}}', section.title)
      .replace('{{SECTION_DESC}}', section.description)
      .replace('{{GATHERED_INFO}}', gatheredFindings);

    let proposedQueries: string[] = [];
    try {
      const rawQueries = await callLLM(
        proposalPrompt,
        'You are an expert search planner.',
        overrides,
        60_000,
      );
      const parsed = parseJsonObject<{ queries: string[] }>(rawQueries);
      if (Array.isArray(parsed.queries)) {
        proposedQueries = parsed.queries.map((q) => String(q).trim()).filter(Boolean);
      }
    } catch (error) {
      console.warn(
        `[Deep Research] Failed to propose queries for section ${section.title} at depth ${depth}`,
        error,
      );
    }

    // Fallback if model fails to output JSON queries
    if (proposedQueries.length === 0) {
      proposedQueries = [`${section.title} ${section.description}`.slice(0, 80)];
    }

    const deterministicQueries =
      depth === 1 ? buildDeterministicSectionQueries(userPrompt, section, temporalContext) : [];

    // Keep each research branch bounded so deep research remains predictable.
    const currentQueries = dedupeQueries([...deterministicQueries, ...proposedQueries]).slice(
      0,
      queriesPerDepth,
    );
    queriesUsed.push(...currentQueries);

    reportProgress(
      onProgress,
      `  [Depth ${depth}] 执行检索: ${currentQueries.map((q) => `"${q}"`).join(', ')}`,
    );

    // 2. Perform web search & page content crawling
    const searchResults = await runSearchBatch(currentQueries, searchOptions);
    const rankedResults = rankSources(searchResults, temporalContext);
    const selectedEvidence = selectEvidenceSources(rankedResults, temporalContext);
    const evidenceSelectionSummary = buildEvidenceSelectionSummary(
      selectedEvidence,
      rankedResults,
      temporalContext,
    );

    // 3. Register crawled sources to the global registry before extraction so
    // section findings cite stable final source ids instead of local batch ids.
    const sectionSourceRefs = registerEvidenceSources(
      selectedEvidence,
      globalSources,
      sourceIndexMap,
    );

    reportProgress(
      onProgress,
      `  [Depth ${depth}] 抓取成功，共分析 ${selectedEvidence.length} 个参考页。${evidenceSelectionSummary} 正在整合提取知识...`,
    );

    // 4. Extract and Synthesize findings
    const evidenceBlocks = formatEvidenceBlocks(sectionSourceRefs);
    const extractorPrompt = SECTION_FINDINGS_EXTRACTOR_PROMPT.replace(
      '{{SECTION_TITLE}}',
      section.title,
    )
      .replace('{{SECTION_DESC}}', section.description)
      .replace('{{EVIDENCE_BLOCKS}}', evidenceBlocks || 'No new page content could be retrieved.')
      .replace('{{PREVIOUS_FINDINGS}}', gatheredFindings);

    try {
      const rawFindings = await callLLM(
        extractorPrompt,
        'You are a factual information extraction agent.',
        overrides,
        90_000,
      );
      const parsed = parseJsonObject<{ findings: string; gaps: string }>(rawFindings);
      if (parsed.findings) {
        gatheredFindings = parsed.findings;
      }
      if (parsed.gaps !== undefined) {
        gaps = parsed.gaps;
      } else {
        gaps = ''; // Stop loop if gaps is missing
      }
    } catch (error) {
      console.error(
        `[Deep Research] Extraction failed for section ${section.title} at depth ${depth}`,
        error,
      );
      break; // Abort loop on crash
    }

    if (gaps.trim().length > 0) {
      reportProgress(
        onProgress,
        `  [Depth ${depth}] 发现信息缺口: "${gaps.slice(0, 100)}..."，继续深入检索...`,
      );
    }
    depth++;
  }

  return {
    draft: gatheredFindings,
    queriesUsed: dedupeQueries(queriesUsed),
  };
}

export async function buildDeepResearchContext(
  userPrompt: string,
  overrides?: Partial<AIServiceConfig>,
  onProgress?: ProgressReporter,
): Promise<DeepResearchContext> {
  const temporalContext = detectTemporalContext(userPrompt);

  reportProgress(
    onProgress,
    `[深度研究] 启动智能深度探索引擎。当前日期: ${temporalContext.today}。研究预算：最多 ${MAX_RESEARCH_SECTIONS} 个章节、每章 ${RESEARCH_MAX_DEPTH} 轮、每轮 ${
      temporalContext.isMarketForecast ? MARKET_QUERIES_PER_DEPTH : QUERIES_PER_DEPTH
    } 个检索词。`,
  );

  // 1. Plan Outline
  reportProgress(onProgress, `[深度研究] 正在根据研究目标设计大纲与章节结构...`);
  const outline = await planResearchOutline(userPrompt, temporalContext, overrides);

  const outlineListMsg = outline.sections
    .map((s, idx) => `  ${idx + 1}. 【${s.title}】：${s.description}`)
    .join('\n');
  reportProgress(onProgress, `[深度研究] 研究大纲已确定：\n${outlineListMsg}`);

  // 2. Iterate section by section in parallel
  const globalSources: SearchResult[] = [];
  const sourceIndexMap = new Map<string, number>();
  const sectionDrafts: string[] = [];
  const allQueriesUsed: string[] = [];

  if (temporalContext.isMarketForecast) {
    reportProgress(onProgress, `[深度研究] 正在抓取 A 股主要指数实时行情快照作为市场基准...`);
    const marketSnapshotSources = await fetchAshareMarketSnapshot();
    const marketSnapshotRefs = registerEvidenceSources(
      marketSnapshotSources,
      globalSources,
      sourceIndexMap,
    );

    if (marketSnapshotRefs.length > 0) {
      sectionDrafts.push(
        [
          '## 市场实时数据基准',
          '',
          '以下快照作为本次研究开始时的指数行情基准，后续结论仍需结合新闻、政策、资金面和技术面来源交叉验证。',
          '',
          formatEvidenceBlocks(marketSnapshotRefs),
        ].join('\n'),
      );
      allQueriesUsed.push('东方财富 A股主要指数实时行情快照');
      reportProgress(
        onProgress,
        `[深度研究] 已接入 ${marketSnapshotRefs.length} 条 A 股实时行情基准来源。`,
      );
    } else {
      reportProgress(onProgress, `[深度研究] A 股实时行情快照暂不可用，将继续使用多源网页检索。`);
    }
  }

  for (let idx = 0; idx < outline.sections.length; idx++) {
    const section = outline.sections[idx];
    if (!section) continue;

    reportProgress(
      onProgress,
      `[深度研究] [${idx + 1}/${outline.sections.length}] 开始研究章节【${section.title}】...`,
    );

    const result = await researchSection(
      userPrompt,
      section,
      temporalContext,
      globalSources,
      sourceIndexMap,
      overrides,
      onProgress,
    );

    sectionDrafts.push(`## ${section.title}\n\n${result.draft}`);
    allQueriesUsed.push(...result.queriesUsed);
  }

  // 3. Compile report
  reportProgress(onProgress, `[深度研究] 正在汇编各章节大纲草稿，梳理全局引用源...`);
  const compiledDraftsText = sectionDrafts.join('\n\n');

  let synthesisReport: string;
  try {
    const compilerPrompt = FINAL_COMPILER_PROMPT.replace('{{USER_PROMPT}}', userPrompt)
      .replace('{{SECTION_DRAFTS}}', compiledDraftsText)
      .replace('{{TEMPORAL_RULES}}', temporalContext.answerRules);

    synthesisReport = await callLLM(
      compilerPrompt,
      'You are a compiler editor agent.',
      overrides,
      180_000,
    );
  } catch (error) {
    console.error(
      '[Deep Research] Final compilation failed. Falling back to concatenated drafts.',
      error,
    );
    synthesisReport = compiledDraftsText;
  }

  reportProgress(
    onProgress,
    `[深度研究] 全文汇编完成。共计引用了 ${globalSources.length} 个独立参考来源。`,
  );

  const groundingSections = [
    DEEP_RESEARCH_REPORTING_RULES,
    `【强制时效与引用规则】\n${temporalContext.answerRules}\n\n只能引用“最终证据源”中的来源；不要引用候选源、旧预测、无日期普通帖子。`,
    `【研究底稿】\n${synthesisReport}`,
    buildCitationIntegrityAudit(synthesisReport, globalSources.length),
    buildResearchQualityAudit(globalSources, temporalContext),
    buildFreshnessAudit(
      globalSources.map((s) => scoreSource(s, temporalContext)),
      temporalContext,
    ),
    buildTraceSection(dedupeQueries(allQueriesUsed), globalSources, temporalContext),
    formatSearchResultsAsPrompt(globalSources, '【最终证据源】'),
  ].filter(Boolean);

  return {
    queries: dedupeQueries(allQueriesUsed),
    sources: globalSources,
    groundingPrompt: groundingSections.join('\n\n').trim(),
  };
}
