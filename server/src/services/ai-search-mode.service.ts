import { callLLM, type AIServiceConfig } from './ai.service';
import { logger } from '../utils/logger';
import {
  assessSearchResultQuality,
  formatSearchResultsAsPrompt,
  performWebSearch,
  type SearchResult,
} from './search.service';

export type ResearchSource = {
  title: string;
  link: string;
  domain: string;
  publishedAt?: string;
  evidenceTier?: 'primary' | 'strong' | 'context' | 'weak';
  evidenceType?: string;
  sourceIndex?: number;
  credibilityScore?: number;
  freshnessLabel?: string;
  dateConfidence?: 'known' | 'unknown';
  qualitySignals?: string[];
};

type SearchFreshnessProfile = {
  isFresh: boolean;
  isMarket: boolean;
  isTechnicalTooling: boolean;
  isProductUpgrade: boolean;
  recencyDays: number;
};

type SearchPlan = {
  queries: string[];
  mustCover: string[];
  answerFocus: string;
};

type RankedSearchModeSource = SearchResult & {
  score: number;
  ageDays: number | null;
  freshnessLabel: string;
  dateConfidence: 'known' | 'unknown';
  qualitySignals: string[];
  evidenceTier: 'primary' | 'strong' | 'context' | 'weak';
  evidenceType: string;
};

export type SearchModeContext = {
  sources: ResearchSource[];
  groundingPrompt: string;
  sourceCount: number;
  strongEvidenceCount: number;
  domainCount: number;
};

type ProgressReporter = (update: string) => void;

const MAX_SEARCH_PLAN_QUERIES = 5;

const SEARCH_MODE_TRUSTED_FRESH_DOMAINS = [
  'eastmoney.com',
  'finance.eastmoney.com',
  'quote.eastmoney.com',
  'sse.com.cn',
  'szse.cn',
  'cninfo.com.cn',
  'csrc.gov.cn',
  'pbc.gov.cn',
  'stats.gov.cn',
  'mof.gov.cn',
  'sec.gov',
  'federalreserve.gov',
  'bls.gov',
  'bea.gov',
  'reuters.com',
  'bloomberg.com',
  'cnbc.com',
];

const SEARCH_PLAN_PROMPT = `You are a premium web-search planning agent.
Create a compact search plan for the user's question before retrieval.

Current date: {{TODAY}} (Asia/Shanghai)
User question: {{QUERY}}

Return ONLY valid JSON matching:
{
  "queries": ["3 to 5 short search-engine queries"],
  "mustCover": ["3 to 5 evidence angles the final answer must cover"],
  "answerFocus": "one concise sentence describing the best answer structure"
}

Planning rules:
1. Prefer primary sources: official docs, source repositories, standards, release notes, regulators, credible data/news sources.
2. If the user asks about tools, open-source projects, technical selection, or product upgrades, include queries for GitHub, official docs, benchmarks, architecture, license/maintenance risks, and comparable products.
3. If the question is time-sensitive, include latest/recent/{{YEAR}} wording and prioritize fresh sources.
4. Mix Chinese and English queries when it improves recall.
5. Ensure source diversity: include at least one query that can surface primary/official evidence and one query that can surface opposing views, limitations, or real adoption risks.
6. Do not include long sentences, Markdown, comments, or explanation.`;

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

function cleanSearchQueryLine(value: string): string {
  return value
    .replace(/^\d+[\).\s-]*/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeSearchQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const query of queries) {
    const cleaned = cleanSearchQueryLine(query);
    const normalized = cleaned.toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(cleaned);
  }

  return deduped.slice(0, MAX_SEARCH_PLAN_QUERIES);
}

function detectSearchRecency(query: string): SearchFreshnessProfile {
  const isFresh =
    /(今天|昨日|昨天|明天|本周|这周|下周|近期|最近|最新|刚刚|实时|走势|预测|展望|today|yesterday|tomorrow|this week|next week|latest|recent|live|breaking|forecast|outlook)/i.test(
      query,
    );

  const isMarket =
    /(股市|股票|a股|港股|美股|纳指|纳斯达克|标普|道指|沪深|大盘|指数|行情|财报|market|stock|nasdaq|s&p|dow|equity|earnings|fed|fomc)/i.test(
      query,
    );

  const isTechnicalTooling =
    /(工具|开源|项目|框架|库|插件|agent|github|技术选型|竞品|benchmark|open source|tool|framework|library|plugin|sdk|api|implementation|architecture|repository|repo)/i.test(
      query,
    );

  const isProductUpgrade =
    /(升级|增强|改造|引入|学习|借鉴|市面|竞品|产品|体验|功能|方案|路线图|upgrade|improve|enhance|integrate|adopt|compare|roadmap|product)/i.test(
      query,
    );

  return {
    isFresh,
    isMarket,
    isTechnicalTooling,
    isProductUpgrade,
    recencyDays: isMarket ? 10 : isFresh ? 30 : 0,
  };
}

function normalizeSearchSourceKey(source: SearchResult): string {
  try {
    const url = new URL(source.link);
    url.hash = '';
    url.searchParams.sort();
    return url.toString().toLowerCase();
  } catch {
    return source.link.trim().toLowerCase();
  }
}

function dedupeSearchSources(sources: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const source of sources) {
    const key = normalizeSearchSourceKey(source);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }

  return deduped;
}

function scoreSearchModeSource(
  source: SearchResult,
  freshness: SearchFreshnessProfile,
): RankedSearchModeSource {
  const domain = (source.domain || '').toLowerCase();
  const link = (source.link || '').toLowerCase();
  const title = (source.title || '').toLowerCase();
  const quality = assessSearchResultQuality(source, {
    recencyDays: freshness.recencyDays,
    requireFreshness: freshness.isFresh || freshness.isMarket,
    trustedFreshDomains: freshness.isMarket ? SEARCH_MODE_TRUSTED_FRESH_DOMAINS : [],
  });
  let score = quality.credibilityScore;

  if (quality.evidenceTier === 'primary') score += 4;
  if (quality.evidenceTier === 'strong') score += 2;
  if (quality.evidenceTier === 'weak') score -= 14;
  if ((source.content || source.snippet || '').length > 3000) score += 3;
  if (domain.endsWith('.gov') || domain.endsWith('.edu') || domain.endsWith('gov.cn')) score += 8;
  if (domain.includes('github.com') || link.includes('/releases') || link.includes('/issues')) {
    score += freshness.isTechnicalTooling || freshness.isProductUpgrade ? 12 : 4;
  }
  if (title.includes('official') || title.includes('docs') || title.includes('documentation')) {
    score += 5;
  }

  if (freshness.isFresh) {
    if (quality.ageDays === null) score -= freshness.isMarket ? 8 : 4;
    else if (quality.ageDays <= 2) score += 12;
    else if (quality.ageDays <= freshness.recencyDays) score += 6;
    else score -= 18;
  }

  return {
    ...source,
    score: Math.max(0, Math.min(100, score)),
    ageDays: quality.ageDays,
    freshnessLabel: quality.freshnessLabel,
    dateConfidence: quality.dateConfidence,
    qualitySignals: quality.signals,
    evidenceTier: quality.evidenceTier,
    evidenceType: quality.evidenceType,
  };
}

function selectSearchModeSources(
  sources: SearchResult[],
  freshness: SearchFreshnessProfile,
): RankedSearchModeSource[] {
  const ranked = dedupeSearchSources(sources)
    .map((source) => scoreSearchModeSource(source, freshness))
    .sort((a, b) => b.score - a.score);
  const selected: RankedSearchModeSource[] = [];
  const domainCounts = new Map<string, number>();
  const perDomainLimit = freshness.isProductUpgrade || freshness.isTechnicalTooling ? 4 : 3;

  for (const source of ranked) {
    const domain = (source.domain || 'unknown').toLowerCase();
    const currentCount = domainCounts.get(domain) || 0;
    if (currentCount >= perDomainLimit) continue;
    selected.push(source);
    domainCounts.set(domain, currentCount + 1);
    if (selected.length >= 16) break;
  }

  return selected.length > 0 ? selected : ranked.slice(0, 12);
}

export function mapSearchResultToResearchSource(
  source: SearchResult,
  index: number,
): ResearchSource {
  const quality = assessSearchResultQuality(source);
  return {
    title: source.title,
    link: source.link,
    domain: source.domain,
    publishedAt: source.publishedAt,
    sourceIndex: index + 1,
    credibilityScore: quality.credibilityScore,
    freshnessLabel: quality.freshnessLabel,
    dateConfidence: quality.dateConfidence,
    qualitySignals: quality.signals,
    evidenceTier: quality.evidenceTier,
    evidenceType: quality.evidenceType,
  };
}

function mapRankedSearchSources(sources: RankedSearchModeSource[]): ResearchSource[] {
  return sources.map((source, index) => ({
    title: source.title,
    link: source.link,
    domain: source.domain,
    publishedAt: source.publishedAt,
    sourceIndex: index + 1,
    credibilityScore: source.score,
    freshnessLabel: source.freshnessLabel,
    dateConfidence: source.dateConfidence,
    qualitySignals: source.qualitySignals,
    evidenceTier: source.evidenceTier,
    evidenceType: source.evidenceType,
  }));
}

function buildSearchEvidenceAudit(
  sources: RankedSearchModeSource[],
  plan: SearchPlan,
  freshness: SearchFreshnessProfile,
): string {
  const domains = new Set(sources.map((source) => source.domain).filter(Boolean));
  const primary = sources.filter((source) => source.evidenceTier === 'primary').length;
  const strong = sources.filter((source) => source.evidenceTier === 'strong').length;
  const weak = sources.filter((source) => source.evidenceTier === 'weak').length;
  const dated = sources.filter((source) => Boolean(source.publishedAt)).length;
  const averageScore =
    sources.length > 0
      ? Math.round(sources.reduce((sum, source) => sum + source.score, 0) / sources.length)
      : 0;
  const topSources = sources
    .slice(0, 6)
    .map(
      (source, index) =>
        `${index + 1}. [${source.score}/100] ${source.title} (${source.domain || 'unknown'}; ${
          source.freshnessLabel
        }; ${source.evidenceType || source.evidenceTier})`,
    )
    .join('\n');

  return `【证据质量审计】
来源总数：${sources.length}
独立域名：${domains.size}
一手/官方来源：${primary}
强证据来源：${strong}
弱证据/社区补充：${weak}
已识别日期：${dated}
平均可信度：${averageScore}/100
时效策略：${
    freshness.isFresh || freshness.isMarket
      ? `按最近 ${freshness.recencyDays} 天或可信实时源优先`
      : '以权威性、正文完整度和交叉验证优先'
  }
必须覆盖角度：
${plan.mustCover.map((item, index) => `${index + 1}. ${item}`).join('\n')}
Top 来源：
${topSources || '无'}`;
}

function buildFallbackSearchPlan(query: string, freshness: SearchFreshnessProfile): SearchPlan {
  const queries = [query];

  if (freshness.isTechnicalTooling || freshness.isProductUpgrade) {
    queries.push(
      `${query} GitHub open source comparison`,
      `${query} official docs architecture implementation`,
      `${query} benchmarks alternatives limitations`,
      `${query} product UX patterns integration roadmap`,
    );
  } else if (freshness.isMarket) {
    queries.push(
      `${query} 最新 走势 数据`,
      `${query} 机构观点 风险`,
      `${query} policy data latest`,
    );
  } else if (freshness.isFresh) {
    queries.push(`${query} latest 2026`, `${query} recent updates`, `${query} analysis`);
  } else {
    queries.push(`${query} overview evidence`, `${query} best practices`, `${query} risks`);
  }

  return {
    queries: dedupeSearchQueries(queries),
    mustCover:
      freshness.isTechnicalTooling || freshness.isProductUpgrade
        ? ['可借鉴工具/项目', '集成成本', '成熟度与风险', '落地路线图']
        : ['直接结论', '关键证据', '不确定性', '下一步行动'],
    answerFocus:
      freshness.isTechnicalTooling || freshness.isProductUpgrade
        ? '用证据支撑的方案对比、可移植能力和分阶段升级建议。'
        : '先给直接答案，再给证据和可执行建议。',
  };
}

async function buildSearchPlan(
  query: string,
  todayStr: string,
  freshness: SearchFreshnessProfile,
  overrides: Partial<AIServiceConfig>,
): Promise<SearchPlan> {
  const fallback = buildFallbackSearchPlan(query, freshness);

  try {
    const raw = await callLLM(
      SEARCH_PLAN_PROMPT.replace('{{TODAY}}', todayStr)
        .replace('{{YEAR}}', todayStr.slice(0, 4))
        .replace('{{QUERY}}', query),
      'You are a search planning agent.',
      {
        ...overrides,
        maxTokens: 1200,
      },
      45_000,
    );
    const parsed = parseJsonObject<SearchPlan>(raw);
    const plannedQueries = Array.isArray(parsed.queries)
      ? dedupeSearchQueries(parsed.queries.map((q) => String(q)))
      : [];
    const mustCover = Array.isArray(parsed.mustCover)
      ? parsed.mustCover
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const answerFocus =
      typeof parsed.answerFocus === 'string' && parsed.answerFocus.trim()
        ? parsed.answerFocus.trim()
        : fallback.answerFocus;

    return {
      queries: plannedQueries.length > 0 ? plannedQueries : fallback.queries,
      mustCover: mustCover.length > 0 ? mustCover : fallback.mustCover,
      answerFocus,
    };
  } catch (error) {
    logger.warn('[AI Chat] Search plan generation failed, using fallback plan:', error);
    return fallback;
  }
}

async function runSearchPlan(
  plan: SearchPlan,
  freshness: SearchFreshnessProfile,
): Promise<RankedSearchModeSource[]> {
  const runs = await Promise.allSettled(
    plan.queries.map((query, index) =>
      performWebSearch(query, {
        maxResults: index === 0 ? 12 : 8,
        includePageContent: true,
        pageContentLength: freshness.isTechnicalTooling || freshness.isProductUpgrade ? 4600 : 3800,
        maxSearchEngines: 7,
        enableFallbackSearch: true,
        alwaysRunFallbackSearch: index === 0,
        recencyDays: freshness.recencyDays,
        requireFreshness: freshness.isMarket,
        trustedFreshDomains: freshness.isMarket ? SEARCH_MODE_TRUSTED_FRESH_DOMAINS : [],
      }),
    ),
  );

  const results = runs.flatMap((run) => (run.status === 'fulfilled' ? run.value : []));
  return selectSearchModeSources(results, freshness);
}

function buildSearchModeInstructions(
  sourceCount: number,
  todayStr: string,
  freshness: SearchFreshnessProfile,
  plan: SearchPlan,
  evidenceAudit: string,
): string {
  return `【联网搜索增强模式】
当前日期：${todayStr}（Asia/Shanghai）。
你已经收到一个经过“搜索规划、网页正文抓取、来源重排”的实时证据包，共 ${sourceCount} 条来源。

【搜索计划】
检索词：
${plan.queries.map((query, index) => `${index + 1}. ${query}`).join('\n')}

必须覆盖：
${plan.mustCover.map((item, index) => `${index + 1}. ${item}`).join('\n')}

回答焦点：${plan.answerFocus}

${evidenceAudit}

请像高质量搜索型 AI 产品一样回答：
1. 先给出“一句话结论”和“结论摘要”，直接回答用户最关心的问题。
2. 再给出“证据要点”，每条关键事实都尽量带 [1]、[2] 这样的来源编号，并说明证据支持什么。不要使用证据包外的来源编号。
3. 如果用户在问工具、开源项目、技术选型或产品升级，必须输出：
   - “可借鉴工具/开源项目清单”：能力、可移植点、引入方式、许可/维护风险。
   - “方案对比表”：能力、集成成本、成熟度、风险、适用场景、预期用户价值。
   - “落地建议”：快速增强、核心升级、验证指标、后续实验。
4. 如果来源之间有冲突或信息不足，明确写出冲突点/不确定性，不要编造。
5. 对时间敏感问题，必须说明资料时点；${
    freshness.isFresh
      ? `本题具有时效性，优先采用最近 ${freshness.recencyDays} 天内或可信实时来源。`
      : '如果来源日期较旧，请把它当作背景信息而非最新结论。'
  }
6. 最后给出“下一步建议”或“可执行清单”，让用户知道接下来怎么做。
7. 不要输出空泛免责声明；高风险话题只给信息性分析，不给确定性投资、医疗或法律结论。
8. 输出要有观点、有取舍、有优先级，避免泛泛而谈。
9. 如果有建议是基于你的推理而非来源直接写明，请标注为“推断”，并说明验证方式。`;
}

export async function buildSearchModeContext(
  query: string,
  todayStr: string,
  overrides: Partial<AIServiceConfig>,
  onProgress?: ProgressReporter,
): Promise<SearchModeContext> {
  const freshness = detectSearchRecency(query);
  onProgress?.('🔎 正在拆解搜索意图，规划多角度检索词...\n');

  const searchPlan = await buildSearchPlan(query, todayStr, freshness, overrides);
  onProgress?.(
    `🧭 搜索计划已生成：${searchPlan.queries.map((item) => `「${item}」`).join('、')}。\n`,
  );
  onProgress?.('🌐 正在并行检索并抓取网页正文，优先筛选官方、仓库、文档、数据与高可信来源...\n');

  const results = await runSearchPlan(searchPlan, freshness);
  if (results.length === 0) {
    return {
      sources: [],
      groundingPrompt: '',
      sourceCount: 0,
      strongEvidenceCount: 0,
      domainCount: 0,
    };
  }

  const sources = mapRankedSearchSources(results);
  const evidenceAudit = buildSearchEvidenceAudit(results, searchPlan, freshness);
  const strongEvidenceCount = results.filter(
    (source) => source.evidenceTier === 'primary' || source.evidenceTier === 'strong',
  ).length;
  const domainCount = new Set(results.map((source) => source.domain).filter(Boolean)).size;
  const groundingPrompt = `${formatSearchResultsAsPrompt(
    results,
    '【联网搜索证据包】Use this live web search pack for factual grounding. Cite source numbers when relevant:',
  )}\n\n${buildSearchModeInstructions(
    results.length,
    todayStr,
    freshness,
    searchPlan,
    evidenceAudit,
  )}`;

  return {
    sources,
    groundingPrompt,
    sourceCount: results.length,
    strongEvidenceCount,
    domainCount,
  };
}
