import { zipSync } from 'fflate';
import { parseTutorialPackage } from '../src/services/tutorial-package.parser';
import { renderTutorialContent } from '../src/services/tutorial-content.renderer';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+O5vVAAAAAElFTkSuQmCC',
  'base64',
);

const createPackage = () => {
  const tutorial = {
    title: '课程标题',
    summary: '课程简介',
    chapters: [
      {
        title: '基础原理',
        startTime: 0,
        endTime: 60,
        steps: [
          {
            order: 1,
            title: '第一步',
            description: '步骤说明',
            startTime: 0,
            endTime: 30,
            shortcuts: ['Ctrl+1'],
            parameters: [{ name: '层级', value: '2' }],
            warnings: ['注意拓扑'],
            image: 'C:/source/screenshots/step_01_end.png',
            candidates: {
              start: 'C:/source/screenshots/step_01_start.png',
              end: 'C:/source/screenshots/step_01_end.png',
            },
          },
        ],
      },
    ],
  };
  return Buffer.from(
    zipSync({
      '01-basics_tutorial/tutorial.json': Buffer.from(JSON.stringify(tutorial)),
      '01-basics_tutorial/screenshots/step_01_start.png': png,
      '01-basics_tutorial/screenshots/step_01_end.png': png,
    }),
  );
};

describe('tutorial package parser', () => {
  it('parses structured content and keeps only the preferred reference image', async () => {
    const parsed = await parseTutorialPackage(createPackage());
    expect(parsed.title).toBe('01-basics');
    expect(parsed.summary).toBe('课程简介');
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]?.steps).toHaveLength(1);
    expect(parsed.sections[0]?.steps[0]?.imageEntry?.endsWith('step_01_end.png')).toBe(true);
    expect(await parsed.getEntryBuffer(parsed.sections[0]!.steps[0]!.imageEntry!)).toEqual(png);
  });

  it('rejects packages without tutorial.json', async () => {
    const invalid = Buffer.from(zipSync({ 'screenshots/step.png': png }));
    await expect(parseTutorialPackage(invalid)).rejects.toThrow('tutorial.json');
  });

  it('renders the selected image and tutorial metadata for the existing player', async () => {
    const parsed = await parseTutorialPackage(createPackage());
    const html = renderTutorialContent(
      parsed.summary,
      parsed.sections.map((section) => ({
        ...section,
        steps: section.steps.map((step) => ({
          ...step,
          imageUrl: 'https://cdn.example/step.webp',
        })),
      })),
    );
    expect(html).toContain('课程简介');
    expect(html).toContain('第一步');
    expect(html).toContain('Ctrl+1');
    expect(html).toContain('https://cdn.example/step.webp');
    expect(html).not.toContain('step_01_start.png');
  });
});
