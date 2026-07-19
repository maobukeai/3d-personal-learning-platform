import type { TutorialParameter } from './tutorial-package.types';

interface RenderStep {
  order: number;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  shortcuts: unknown;
  parameters: unknown;
  warnings: unknown;
  imageUrl?: string | null;
}

interface RenderSection {
  title: string;
  startTime: number;
  endTime: number;
  steps: RenderStep[];
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const clock = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

const renderStep = (step: RenderStep): string => {
  const shortcuts = asArray<string>(step.shortcuts);
  const parameters = asArray<TutorialParameter>(step.parameters);
  const warnings = asArray<string>(step.warnings);
  return `<article class="tutorial-step" style="display:grid;grid-template-columns:minmax(180px,28%) 1fr;gap:18px;padding:16px;margin:12px 0;border:1px solid var(--border-base);border-radius:14px;background:var(--bg-elevated)">
    ${step.imageUrl ? `<figure style="margin:0"><img src="${escapeHtml(step.imageUrl)}" alt="${escapeHtml(step.title)}" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px" /></figure>` : '<div></div>'}
    <div>
      <header style="display:flex;justify-content:space-between;gap:12px"><h3 style="margin:0 0 8px">${step.order}. ${escapeHtml(step.title)}</h3><time style="white-space:nowrap;color:var(--text-muted)">${clock(step.startTime)} - ${clock(step.endTime)}</time></header>
      <p>${escapeHtml(step.description)}</p>
      ${shortcuts.length ? `<p><strong>快捷键：</strong>${shortcuts.map((item) => `<kbd>${escapeHtml(item)}</kbd>`).join(' ')}</p>` : ''}
      ${parameters.length ? `<dl>${parameters.map((item) => `<dt style="display:inline;font-weight:700">${escapeHtml(item.name)}：</dt><dd style="display:inline;margin:0 14px 0 4px">${escapeHtml(item.value)}</dd>`).join('')}</dl>` : ''}
      ${warnings.map((item) => `<aside style="margin-top:10px;padding:9px 12px;border:1px solid #f4cf63;border-radius:10px;background:#fff8df;color:#725000">⚠ ${escapeHtml(item)}</aside>`).join('')}
    </div>
  </article>`;
};

export function renderTutorialContent(summary: string, sections: RenderSection[]): string {
  return `<div class="tutorial-content">
    ${summary ? `<p style="padding:14px 16px;border:1px solid var(--border-base);border-radius:14px">${escapeHtml(summary)}</p>` : ''}
    ${sections
      .map(
        (section) => `<section class="tutorial-section" style="margin:24px 0">
          <header style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2>${escapeHtml(section.title)}</h2><time style="color:var(--text-muted)">${clock(section.startTime)} - ${clock(section.endTime)}</time></header>
          ${section.steps.map(renderStep).join('')}
        </section>`,
      )
      .join('')}
  </div>`;
}
