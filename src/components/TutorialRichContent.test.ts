import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import type { SetupContext } from 'vue';

vi.mock('@/components/ui/Modal.vue', async () => {
  const { h } = await import('vue');

  return {
    default: {
      name: 'ModalStub',
      props: {
        show: Boolean,
        title: {
          type: String,
          default: '',
        },
      },
      emits: ['close'],
      setup(props: { show: boolean; title: string }, { emit, slots }: SetupContext<['close']>) {
        return () =>
          props.show
            ? h('div', { role: 'dialog', 'aria-label': props.title }, [
                h(
                  'button',
                  {
                    type: 'button',
                    'data-testid': 'modal-close-stub',
                    onClick: () => emit('close'),
                  },
                  '关闭',
                ),
                slots.default?.(),
              ])
            : null;
      },
    },
  };
});

import TutorialRichContent from './TutorialRichContent.vue';

let mountedApp: ReturnType<typeof createApp> | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  mountedApp?.unmount();
  container?.remove();
  mountedApp = null;
  container = null;
});

describe('TutorialRichContent', () => {
  it('shows step details and switches between tutorial images', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mountedApp = createApp(TutorialRichContent, {
      html: `<section class="tutorial-section">
        <h2>细分建模基本原理</h2>
        <article class="tutorial-step">
          <header><h3>1. 理解细分倍增逻辑</h3><time>00:00 - 00:47</time></header>
          <p>细分曲面会增加多边形数量。</p>
          <p><strong>快捷键：</strong><kbd>Shift+D</kbd> <kbd>Ctrl+1</kbd></p>
          <dl><dt>细分层级：</dt><dd>1-3</dd></dl>
          <aside>⚠ 仅四边面能实现良好细分。</aside>
          <img src="/reference-1.webp" alt="第一步参考图">
        </article>
        <article class="tutorial-step">
          <h3>2. 添加细分修改器</h3>
          <p>使用快捷键添加修改器。</p>
          <img src="/reference-2.webp" alt="第二步参考图">
        </article>
      </section>`,
    });
    mountedApp.mount(container);

    const contentImage = container.querySelector<HTMLImageElement>('.tutorial-rich-content img');
    expect(contentImage).not.toBeNull();

    contentImage?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await nextTick();

    const dialog = container.querySelector('[role="dialog"]');
    const previewImage = dialog?.querySelector<HTMLImageElement>('img');
    expect(dialog?.getAttribute('aria-label')).toBe('教程图片预览');
    expect(previewImage?.getAttribute('src')).toBe('http://localhost:3000/reference-1.webp');
    expect(dialog?.textContent).toContain('细分建模基本原理');
    expect(dialog?.textContent).toContain('1. 理解细分倍增逻辑');
    expect(dialog?.textContent).toContain('细分曲面会增加多边形数量。');
    expect(dialog?.textContent).toContain('00:00 - 00:47');
    expect(dialog?.textContent).toContain('Shift+D');
    expect(dialog?.textContent).toContain('Ctrl+1');
    expect(dialog?.textContent).toContain('细分层级');
    expect(dialog?.textContent).toContain('1-3');
    expect(dialog?.textContent).toContain('仅四边面能实现良好细分。');
    expect(dialog?.textContent).toContain('第 1 / 2 个图解步骤');

    dialog?.querySelector<HTMLButtonElement>('[data-testid="tutorial-image-next"]')?.click();
    await nextTick();
    expect(dialog?.querySelector<HTMLImageElement>('img')?.getAttribute('src')).toBe(
      'http://localhost:3000/reference-2.webp',
    );
    expect(dialog?.textContent).toContain('2. 添加细分修改器');
    expect(dialog?.textContent).toContain('第 2 / 2 个图解步骤');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await nextTick();
    expect(dialog?.querySelector<HTMLImageElement>('img')?.getAttribute('src')).toBe(
      'http://localhost:3000/reference-1.webp',
    );

    dialog?.querySelector<HTMLButtonElement>('[data-testid="modal-close-stub"]')?.click();
    await nextTick();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
