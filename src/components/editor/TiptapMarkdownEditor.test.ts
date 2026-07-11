import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('katex/dist/katex.min.css', () => ({}));
vi.mock('md-editor-v3/lib/style.css', () => ({}));

import { createApp, h, ref, nextTick } from 'vue';
import DOMPurify from 'dompurify';

// -----------------------------------------------------------------------------
// 1. Hoisted Mock References
// -----------------------------------------------------------------------------

const {
  mockApiPut,
  mockApiPost,
  mockElMessageWarning,
  mockElMessageSuccess,
  mockElMessageError,
  mockState,
} = vi.hoisted(() => ({
  mockApiPut: vi.fn().mockImplementation(() => Promise.resolve({ data: {} })),
  mockApiPost: vi.fn().mockImplementation(() => Promise.resolve({ data: {} })),
  mockElMessageWarning: vi.fn(),
  mockElMessageSuccess: vi.fn(),
  mockElMessageError: vi.fn(),
  mockState: {
    useTiptap: false,
    capturedOptions: null as any,
    mockEditorInstance: null as any,
  },
}));

// Mock the API helper to avoid real network requests
vi.mock('@/utils/api', () => ({
  default: {
    put: mockApiPut,
    post: mockApiPost,
  },
}));

// Mock router
vi.mock('@/router', () => ({
  default: {},
}));

// Mock local feedback APIs
vi.mock('@/utils/feedbackBridge', () => ({
  ElMessage: {
    warning: mockElMessageWarning,
    success: mockElMessageSuccess,
    error: mockElMessageError,
  },
  ElMessageBox: {
    prompt: vi.fn(),
  },
}));

// Mock pinia stores if transitively imported
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({}),
}));
vi.mock('@/stores/system', () => ({
  useSystemStore: () => ({}),
}));

// Mock custom nodes to avoid heavy Node/KaTeX parsing and import issues
vi.mock('@/components/markdownEditor/extensions/customNodes', () => ({
  MermaidBlock: { name: 'mermaidBlock' },
  KatexBlock: { name: 'katexBlock' },
  KatexInline: { name: 'katexInline' },
  BilibiliCard: { name: 'bilibiliCard' },
  CustomAlert: { name: 'customAlert' },
  Table: { name: 'table' },
  TableRow: { name: 'tableRow' },
  TableCell: { name: 'tableCell' },
  TableHeader: { name: 'tableHeader' },
}));

// Mock useEditor composable from @tiptap/vue-3
vi.mock('@tiptap/vue-3', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tiptap/vue-3')>();
  const { ref } = await import('vue');
  return {
    ...original,
    useEditor: (options: any) => {
      mockState.capturedOptions = options;
      mockState.mockEditorInstance = {
        getHTML: vi.fn(() => '<p>hello</p>'),
        getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
        commands: {
          setContent: vi.fn(),
        },
        setEditable: vi.fn(),
        isActive: vi.fn(() => false),
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        options: options,
      };
      return ref(mockState.mockEditorInstance);
    },
  };
});

// Mock MarkdownEditor using a Proxy module target to bypass strict undefined export checks in Vitest
vi.mock('@/components/MarkdownEditor.vue', () => {
  const { h } = require('vue');
  const moduleTarget = {
    __esModule: true,
    default: {
      name: 'MarkdownEditor',
      render() {
        return h('div', { id: 'mock-markdown-editor' });
      },
    },
  };

  return new Proxy(moduleTarget, {
    get(target, prop) {
      if (prop in target) {
        return (target as any)[prop];
      }
      return undefined;
    },
    has(target, prop) {
      return prop in target;
    },
  });
});

// Mock UI Modal to simplify display in tests
vi.mock('@/components/ui/Modal.vue', () => ({
  default: {
    props: ['show'],
    render() {
      const self = this as any;
      if (!self.show) return null;
      return h('div', { id: 'mock-modal' }, self.$slots.default?.());
    },
  },
}));

// Mock UI Button
vi.mock('@/components/ui/Button.vue', () => ({
  default: {
    render() {
      const self = this as any;
      return h('button', { class: 'mock-button' }, self.$slots.default?.());
    },
  },
}));

// Mock UI Input
vi.mock('@/components/ui/Input.vue', () => ({
  default: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    render() {
      const self = this as any;
      return h('input', {
        class: 'mock-input',
        value: self.modelValue,
        onInput: (e: any) => self.$emit('update:modelValue', e.target.value),
      });
    },
  },
}));

// Mock config/editor to dynamically change flag inside test
vi.mock('@/config/editor', () => ({
  get USE_TIPTAP() {
    return mockState.useTiptap;
  },
}));

// Global mocks registration helper for component mounting
const registerGlobalMocks = (app: any) => {
  app.component('SegmentedControl', {
    props: ['modelValue'],
    render() {
      return h('div', { class: 'segmented-control' }, this.$slots.default?.());
    },
  });
  app.component('el-dropdown', {
    render() {
      return h('div', { class: 'el-dropdown' }, this.$slots.default?.());
    },
  });
  app.component('el-select', {
    props: ['modelValue'],
    render() {
      return h('div', { class: 'el-select' }, this.$slots.default?.());
    },
  });
  app.component('el-option', {
    props: ['label', 'value'],
    render() {
      return h('div', { class: 'el-option' }, this.$slots.default?.());
    },
  });
  app.config.errorHandler = (err: any) => {
    console.error('[Vue Error caught in test app]:', err);
  };
};

// Polling helper to wait for async components to render in tests (uses real timers)
const waitForElement = async (
  container: HTMLElement,
  selector: string,
  timeout = 1000,
): Promise<Element> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = container.querySelector(selector);
    if (el) return el;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Element ${selector} not found within ${timeout}ms`);
};

// -----------------------------------------------------------------------------
// 2. Test Suite
// -----------------------------------------------------------------------------

describe('TiptapMarkdownEditor & NoteEditorDialog Verification Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    mockApiPut.mockClear();
    mockApiPost.mockClear();
    mockElMessageWarning.mockClear();
    mockElMessageSuccess.mockClear();
    mockElMessageError.mockClear();
    mockState.capturedOptions = null;
    mockState.mockEditorInstance = null;
    vi.resetModules();
  });

  // ---------------------------------------------------------------------------
  // TASK 1: Check VITE_USE_TIPTAP flag behavior
  // ---------------------------------------------------------------------------
  describe('Task 1: VITE_USE_TIPTAP Flag Behavior', () => {
    it('should load TiptapMarkdownEditor when USE_TIPTAP is true', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      try {
        mockState.useTiptap = true;
        vi.stubEnv('VITE_USE_TIPTAP', 'true');

        // Dynamically import components so that the fresh value of USE_TIPTAP is read
        const { default: NoteEditorDialog } =
          await import('@/views/Learning/components/NoteEditorDialog.vue');

        const dialogRef = ref<any>(null);
        const app1 = createApp({
          render() {
            return h(NoteEditorDialog, {
              ref: dialogRef,
              myNotebooksList: [],
            });
          },
        });
        registerGlobalMocks(app1);
        app1.mount(container);

        // Open the dialog to mount the editor
        dialogRef.value.open();

        // Wait for async component to render
        const tiptapContainer = await waitForElement(container, '.tiptap-markdown-editor');
        const markdownEditorMock = container.querySelector('#mock-markdown-editor');

        expect(tiptapContainer).not.toBeNull();
        expect(markdownEditorMock).toBeNull();

        app1.unmount();
      } finally {
        vi.unstubAllEnvs();
        document.body.removeChild(container);
      }
    });

    it('should load md-editor-v3 when USE_TIPTAP is false', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      try {
        mockState.useTiptap = false;
        vi.stubEnv('VITE_USE_TIPTAP', 'false');

        const { default: NoteEditorDialog } =
          await import('@/views/Learning/components/NoteEditorDialog.vue');

        const dialogRef = ref<any>(null);
        const app2 = createApp({
          render() {
            return h(NoteEditorDialog, {
              ref: dialogRef,
              myNotebooksList: [],
            });
          },
        });
        registerGlobalMocks(app2);
        app2.mount(container);

        // Open the dialog
        dialogRef.value.open();

        // Wait for async component to render
        const markdownEditorMock2 = await waitForElement(container, '#mock-markdown-editor');
        const tiptapContainer2 = container.querySelector('.tiptap-markdown-editor');

        expect(tiptapContainer2).toBeNull();
        expect(markdownEditorMock2).not.toBeNull();

        app2.unmount();
      } finally {
        vi.unstubAllEnvs();
        document.body.removeChild(container);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // TASK 2: Check copy-paste handling
  // ---------------------------------------------------------------------------
  describe('Task 2: Copy-Paste HTML Sanitization', () => {
    it('should strip formatting styles except highlight background-color', async () => {
      const { default: TiptapMarkdownEditor } = await import('./TiptapMarkdownEditor.vue');

      // Mount TiptapMarkdownEditor to register hooks and capture editorProps
      const container = document.createElement('div');
      const app = createApp({
        render() {
          return h(TiptapMarkdownEditor, { modelValue: '' });
        },
      });
      app.mount(container);

      expect(mockState.capturedOptions).not.toBeNull();
      const transformHTML = mockState.capturedOptions.editorProps.transformPastedHTML;
      expect(transformHTML).toBeTypeOf('function');

      // Test SPAN highlight preservation
      const html1 =
        '<span style="color: red; font-size: 20px; background-color: yellow;">Highlight</span>';
      const output1 = transformHTML(html1);
      expect(output1).toContain('style="background-color: yellow"'); // DOMPurify attributes normalize quotes and space
      expect(output1).not.toContain('color: red');
      expect(output1).not.toContain('font-size');

      // Test MARK highlight preservation
      const html2 = '<mark style="color: blue; background-color: rgb(255, 0, 0);">Mark</mark>';
      const output2 = transformHTML(html2);
      expect(output2).toContain('style="background-color: rgb(255, 0, 0)"');
      expect(output2).not.toContain('color: blue');

      // Test DIV style stripping (should strip completely since it is not SPAN or MARK)
      const html3 = '<div style="background-color: red; font-family: monospace;">Paragraph</div>';
      const output3 = transformHTML(html3);
      expect(output3).toBe('<div>Paragraph</div>');

      app.unmount();
    });

    it('should whitelist only player.bilibili.com iframes and remove others', async () => {
      const { default: TiptapMarkdownEditor } = await import('./TiptapMarkdownEditor.vue');

      const container = document.createElement('div');
      const app = createApp({
        render() {
          return h(TiptapMarkdownEditor, { modelValue: '' });
        },
      });
      app.mount(container);

      const transformHTML = mockState.capturedOptions.editorProps.transformPastedHTML;

      // Whitelisted iframe URLs
      const validIframe1 =
        '<iframe src="https://player.bilibili.com/player.html?bvid=BV1xx"></iframe>';
      const validIframe2 = '<iframe src="//player.bilibili.com/player.html?bvid=BV1yy"></iframe>';
      const validIframe3 =
        '<iframe src="http://player.bilibili.com/player.html?bvid=BV1zz"></iframe>';

      expect(transformHTML(validIframe1)).toContain(
        'src="https://player.bilibili.com/player.html?bvid=BV1xx"',
      );
      expect(transformHTML(validIframe2)).toContain(
        'src="//player.bilibili.com/player.html?bvid=BV1yy"',
      );
      expect(transformHTML(validIframe3)).toContain(
        'src="http://player.bilibili.com/player.html?bvid=BV1zz"',
      );

      // Non-whitelisted iframe URLs (YouTube, malicious, etc.)
      const maliciousIframe1 = '<iframe src="https://youtube.com/embed/1234"></iframe>';
      const maliciousIframe2 = '<iframe src="https://evil.bilibili.com/phishing"></iframe>';
      const maliciousIframe3 = '<iframe src="https://example.com/malicious-script.js"></iframe>';

      expect(transformHTML(maliciousIframe1)).toBe('');
      expect(transformHTML(maliciousIframe2)).toBe('');
      expect(transformHTML(maliciousIframe3)).toBe('');

      app.unmount();
    });
  });

  // ---------------------------------------------------------------------------
  // TASK 3: Verify autosave
  // ---------------------------------------------------------------------------
  describe('Task 3: Autosave to localStorage and Remote API', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should save to localStorage after 1s, and to backend API after 3s when noteId is provided', async () => {
      const { default: TiptapMarkdownEditor } = await import('./TiptapMarkdownEditor.vue');

      const container = document.createElement('div');
      const app = createApp({
        render() {
          return h(TiptapMarkdownEditor, {
            modelValue: 'Initial content',
            noteId: 'test-note-123',
          });
        },
      });
      app.mount(container);

      // Trigger change in the editor
      mockState.mockEditorInstance.getHTML.mockReturnValue('<p>New content typed</p>');

      // Invoke Tiptap's onUpdate handler
      mockState.capturedOptions.onUpdate({ editor: mockState.mockEditorInstance });

      // Fast forward 500ms -> should not write to localStorage or remote yet
      await vi.advanceTimersByTimeAsync(500);
      expect(localStorage.getItem('note-draft-test-note-123')).toBeNull();
      expect(mockApiPut).not.toHaveBeenCalled();

      // Fast forward to 1.1s total -> should write to localStorage
      await vi.advanceTimersByTimeAsync(600);
      expect(localStorage.getItem('note-draft-test-note-123')).toBe('New content typed');
      expect(mockApiPut).not.toHaveBeenCalled();

      // Fast forward to 3.1s total -> should trigger remote save (PUT /api/notes/test-note-123)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockApiPut).toHaveBeenCalledTimes(1);
      expect(mockApiPut).toHaveBeenCalledWith('/api/notes/test-note-123', {
        content: 'New content typed',
      });

      // After remote save success, localStorage draft should be removed
      expect(localStorage.getItem('note-draft-test-note-123')).toBeNull();

      app.unmount();
    });

    it('should not call remote API if noteId is not provided, but still save to localStorage under temp key', async () => {
      const { default: TiptapMarkdownEditor } = await import('./TiptapMarkdownEditor.vue');

      const container = document.createElement('div');
      const app = createApp({
        render() {
          return h(TiptapMarkdownEditor, {
            modelValue: 'Initial draft',
          });
        },
      });
      app.mount(container);

      mockState.mockEditorInstance.getHTML.mockReturnValue('<p>Draft of unsaved note</p>');
      mockState.capturedOptions.onUpdate({ editor: mockState.mockEditorInstance });

      // Fast forward 1.5s -> should save to localStorage under temp key
      await vi.advanceTimersByTimeAsync(1500);
      expect(localStorage.getItem('note-draft-temp')).toBe('Draft of unsaved note');
      expect(mockApiPut).not.toHaveBeenCalled();

      // Fast forward 4s -> still no remote call
      await vi.advanceTimersByTimeAsync(2500);
      expect(mockApiPut).not.toHaveBeenCalled();
      expect(localStorage.getItem('note-draft-temp')).toBe('Draft of unsaved note'); // draft remains

      app.unmount();
    });

    it('should update saveStatus to error and NOT delete localStorage draft if remote save fails', async () => {
      const { default: TiptapMarkdownEditor } = await import('./TiptapMarkdownEditor.vue');

      // Mock API PUT failure
      mockApiPut.mockImplementationOnce(() => Promise.reject(new Error('Network disconnected')));

      const container = document.createElement('div');
      const app = createApp({
        render() {
          return h(TiptapMarkdownEditor, {
            modelValue: 'Some text',
            noteId: 'fail-note-456',
          });
        },
      });
      app.mount(container);

      mockState.mockEditorInstance.getHTML.mockReturnValue('<p>Content to save</p>');
      mockState.capturedOptions.onUpdate({ editor: mockState.mockEditorInstance });

      // Advance past all timers (3.5s)
      await vi.advanceTimersByTimeAsync(3500);

      // Verify remote call attempted
      expect(mockApiPut).toHaveBeenCalledTimes(1);

      // Since it failed, localStorage should still contain the draft to prevent data loss
      expect(localStorage.getItem('note-draft-fail-note-456')).toBe('Content to save');

      app.unmount();
    });
  });

  // ---------------------------------------------------------------------------
  // TASK 4: Verify empty content checks
  // ---------------------------------------------------------------------------
  describe('Task 4: Empty Content Validation for Custom Nodes', () => {
    it('should consider a note containing only custom nodes (e.g. bilibiliCard, katexBlock, etc.) as NOT empty', async () => {
      const { default: TiptapMarkdownEditor } = await import('./TiptapMarkdownEditor.vue');

      const container = document.createElement('div');
      const editorRef = ref<any>(null);
      const app = createApp({
        render() {
          return h(TiptapMarkdownEditor, {
            ref: editorRef,
            modelValue: '',
          });
        },
      });
      app.mount(container);

      // 1. Verify truly empty states
      mockState.mockEditorInstance.getJSON.mockReturnValue({
        type: 'doc',
        content: [],
      });
      expect(editorRef.value.isEmpty()).toBe(true);

      mockState.mockEditorInstance.getJSON.mockReturnValue({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [],
          },
        ],
      });
      expect(editorRef.value.isEmpty()).toBe(true);

      // 2. Verify custom Bilibili card only
      mockState.mockEditorInstance.getJSON.mockReturnValue({
        type: 'doc',
        content: [
          {
            type: 'bilibiliCard',
            attrs: { bvid: 'BV1xx', url: 'https://player.bilibili.com/...' },
          },
        ],
      });
      expect(editorRef.value.isEmpty()).toBe(false);

      // 3. Verify custom KaTeX block only
      mockState.mockEditorInstance.getJSON.mockReturnValue({
        type: 'doc',
        content: [
          {
            type: 'katexBlock',
            attrs: { math: 'E = mc^2' },
          },
        ],
      });
      expect(editorRef.value.isEmpty()).toBe(false);

      // 4. Verify custom Mermaid block only
      mockState.mockEditorInstance.getJSON.mockReturnValue({
        type: 'doc',
        content: [
          {
            type: 'mermaidBlock',
            attrs: { code: 'graph TD\n  A --> B' },
          },
        ],
      });
      expect(editorRef.value.isEmpty()).toBe(false);

      // 5. Verify image only
      mockState.mockEditorInstance.getJSON.mockReturnValue({
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: { src: 'img.png' },
          },
        ],
      });
      expect(editorRef.value.isEmpty()).toBe(false);

      app.unmount();
    });
  });
});
