export interface PreviewParameter {
  name: string;
  value: string;
}

export interface PreviewImage {
  src: string;
  alt: string;
  title: string;
  description: string;
  sectionTitle: string;
  timeRange: string;
  shortcuts: string[];
  parameters: PreviewParameter[];
  warnings: string[];
}

const normalizeText = (value?: string | null) => value?.replace(/\s+/g, ' ').trim() || '';

const readParameters = (step: Element | null): PreviewParameter[] => {
  if (!step) return [];
  return Array.from(step.querySelectorAll('dl dt')).map((term) => ({
    name: normalizeText(term.textContent).replace(/[：:]$/, ''),
    value: normalizeText(term.nextElementSibling?.textContent),
  }));
};

export const readTutorialPreviewImage = (image: HTMLImageElement): PreviewImage => {
  const step = image.closest('.tutorial-step');
  const section = image.closest('.tutorial-section');
  const alt = normalizeText(image.alt) || '教程参考图';
  const paragraphs = step ? Array.from(step.querySelectorAll('p')) : [];
  const description = paragraphs.find((paragraph) => !paragraph.querySelector('kbd'));

  return {
    src: image.currentSrc || image.src,
    alt,
    title: normalizeText(step?.querySelector('h3')?.textContent) || alt,
    description: normalizeText(description?.textContent),
    sectionTitle: normalizeText(section?.querySelector('h2')?.textContent),
    timeRange: normalizeText(step?.querySelector('time')?.textContent),
    shortcuts: step
      ? Array.from(step.querySelectorAll('kbd')).map((item) => normalizeText(item.textContent))
      : [],
    parameters: readParameters(step),
    warnings: step
      ? Array.from(step.querySelectorAll('aside')).map((item) => normalizeText(item.textContent))
      : [],
  };
};
