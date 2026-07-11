import { describe, it, expect } from 'vitest';
import { markdownToTiptapJson, tiptapJsonToMarkdown, verifyRoundTrip } from '@/utils/tiptapAst'; // * * P9 直接 AST 转换路径的单元测试 —— 不依赖 Tiptap 编辑器实例，纯函数测试。 * 覆盖：基础语法、自定义节点（Mermaid/KaTeX/Alert/Bilibili/Table）、嵌套结构、round-trip 保真。
describe('tiptapAst — P9 直接 AST 转换', () => {
  describe('markdownToTiptapJson', () => {
    it('空字符串返回最小 doc', () => {
      const doc = markdownToTiptapJson('');
      expect(doc.type).toBe('doc');
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe('paragraph');
    });
    it('仅含空白行的文档返回空段落兜底', () => {
      const doc = markdownToTiptapJson('\n\n\n');
      expect(doc.type).toBe('doc');
      expect(doc.content.length).toBeGreaterThanOrEqual(1);
    });
    it('标题转换为 heading 节点', () => {
      const doc = markdownToTiptapJson('# Hello');
      expect(doc.content[0].type).toBe('heading');
      expect(doc.content[0].attrs?.level).toBe(1);
      expect(doc.content[0].content?.[0].text).toBe('Hello');
    });
    it('空段落保留为空 paragraph 节点', () => {
      const doc = markdownToTiptapJson('第一段\n\n\n第二段');
      const paragraphs = doc.content.filter((n) => n.type === 'paragraph');
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    });
    it('有序列表带 start 属性时保留起始序号', () => {
      const doc = markdownToTiptapJson('3. 第三项\n4. 第四项');
      const list = doc.content.find((n) => n.type === 'orderedList');
      expect(list).toBeDefined();
      expect(list?.attrs?.start).toBe(3);
    });
    it('嵌套行内标记触发 applyMark 递归（加粗内含链接）', () => {
      const doc = markdownToTiptapJson('**[链接](https://example.com)**');
      const para = doc.content[0];
      expect(para.type).toBe('paragraph');
      const textNode = para.content?.find((n) => n.type === 'text');
      expect(textNode).toBeDefined();
      const marks = textNode?.marks?.map((m) => m.type) || [];
      expect(marks).toContain('bold');
      expect(marks).toContain('link');
    });
    it('纯空白行产生空段落节点', () => {
      // marked 对纯空白行会生成空 tokens，convertBlockTokens 遇到空段落时保留空 paragraph
      const doc = markdownToTiptapJson('\n\n\n');
      // 空文档兜底逻辑（line 340）至少产生一个段落
      expect(doc.content.length).toBeGreaterThanOrEqual(1);
    });

    it('仅含空格的段落保留为空 paragraph 节点', () => {
      // marked 会生成空 tokens 的 paragraph，触发 line 181 的空段落分支
      const doc = markdownToTiptapJson(' ');
      expect(doc.type).toBe('doc');
      // 至少有一个段落节点
      expect(doc.content.length).toBeGreaterThanOrEqual(1);
    });

    it('代码块转换为 codeBlock 节点', () => {
      const doc = markdownToTiptapJson('```js\nconsole.log(1)\n```');
      expect(doc.content[0].type).toBe('codeBlock');
      expect(doc.content[0].attrs?.language).toBe('js');
      expect(doc.content[0].content?.[0].text).toBe('console.log(1)');
    });
    it('Mermaid 代码块转换为 mermaidBlock atom 节点', () => {
      const doc = markdownToTiptapJson('```mermaid\ngraph TD\nA-->B\n```');
      expect(doc.content[0].type).toBe('mermaidBlock');
      expect(doc.content[0].attrs?.code).toBe('graph TD\nA-->B');
    });
    it('KaTeX 块转换为 katexBlock atom 节点', () => {
      const doc = markdownToTiptapJson('$$\nx^2 + y^2 = z^2\n$$');
      expect(doc.content[0].type).toBe('katexBlock');
      expect(doc.content[0].attrs?.math).toBe('x^2 + y^2 = z^2');
    });
    it('KaTeX 行内转换为 katexInline atom 节点', () => {
      const doc = markdownToTiptapJson('行内公式 $E=mc^2$ 结束');
      const para = doc.content[0];
      expect(para.type).toBe('paragraph');
      const katexNode = para.content?.find((n) => n.type === 'katexInline');
      expect(katexNode?.attrs?.math).toBe('E=mc^2');
    });
    it('自定义提示块转换为 customAlert 节点', () => {
      const doc = markdownToTiptapJson('::: warning\n这是警告\n:::');
      expect(doc.content[0].type).toBe('customAlert');
      expect(doc.content[0].attrs?.alertType).toBe('warning');
    });
    it('Bilibili 卡片转换为 bilibiliCard atom 节点', () => {
      const md = '[video](https://www.bilibili.com/video/BV1xx411c7mD)';
      const doc = markdownToTiptapJson(md);
      expect(doc.content[0].type).toBe('bilibiliCard');
      expect(doc.content[0].attrs?.bvid).toBe('BV1xx411c7mD');
    });
    it('任务列表转换为 taskList + taskItem', () => {
      const doc = markdownToTiptapJson('- [x] 已完成\n- [ ] 未完成');
      expect(doc.content[0].type).toBe('taskList');
      const items = doc.content[0].content || [];
      expect(items[0].type).toBe('taskItem');
      expect(items[0].attrs?.checked).toBe(true);
      expect(items[1].attrs?.checked).toBe(false);
    });
    it('有序列表转换为 orderedList + listItem', () => {
      const doc = markdownToTiptapJson('1. 第一\n2. 第二');
      expect(doc.content[0].type).toBe('orderedList');
      const items = doc.content[0].content || [];
      expect(items).toHaveLength(2);
      expect(items[0].type).toBe('listItem');
    });
    it('引用块转换为 blockquote 节点', () => {
      const doc = markdownToTiptapJson('> 这是引用');
      expect(doc.content[0].type).toBe('blockquote');
    });
    it('分隔线转换为 horizontalRule 节点', () => {
      const doc = markdownToTiptapJson('---');
      expect(doc.content[0].type).toBe('horizontalRule');
    });
    it('GFM 表格转换为 table 节点（含 header 行和 body 行）', () => {
      // covers convertBlockTokens table branch: lines 144 (header map), 158-159 (rows forEach/map)
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const doc = markdownToTiptapJson(md);
      expect(doc.content[0].type).toBe('table');
      const rows = doc.content[0].content || [];
      expect(rows).toHaveLength(2); // 1 header row + 1 data row
      expect(rows[0].content?.[0].type).toBe('tableHeader');
      expect(rows[1].content?.[0].type).toBe('tableCell');
    });
    it('行内标记（加粗/斜体/删除线/代码/链接）正确转换', () => {
      const doc = markdownToTiptapJson(
        '**粗体** *斜体* ~~删除~~ `代码` [链接](https://example.com)',
      );
      const para = doc.content[0];
      expect(para.type).toBe('paragraph');
      const nodes = para.content || []; // 验证 bold mark
      const boldNode = nodes.find((n) => n.marks?.some((m) => m.type === 'bold'));
      expect(boldNode?.text).toBe('粗体'); // 验证 italic mark
      const italicNode = nodes.find((n) => n.marks?.some((m) => m.type === 'italic'));
      expect(italicNode?.text).toBe('斜体'); // 验证 strike mark
      const strikeNode = nodes.find((n) => n.marks?.some((m) => m.type === 'strike'));
      expect(strikeNode?.text).toBe('删除'); // 验证 code mark
      const codeNode = nodes.find((n) => n.marks?.some((m) => m.type === 'code'));
      expect(codeNode?.text).toBe('代码'); // 验证 link mark
      const linkNode = nodes.find((n) => n.marks?.some((m) => m.type === 'link'));
      expect(linkNode?.text).toBe('链接');
    });
  });
  describe('tiptapJsonToMarkdown', () => {
    it('标题序列化为 # 语法', () => {
      const doc = markdownToTiptapJson('## 标题二');
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toBe('## 标题二');
    });
    it('Mermaid 块序列化为 ```mermaid 代码块', () => {
      const doc = markdownToTiptapJson('```mermaid\ngraph TD\nA-->B\n```');
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('```mermaid');
      expect(md).toContain('graph TD\nA-->B');
    });
    it('KaTeX 块序列化为 $$...$$', () => {
      const doc = markdownToTiptapJson('$$\nx^2\n$$');
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('$$');
      expect(md).toContain('x^2');
    });
    it('自定义提示块序列化为 ::: 语法', () => {
      const doc = markdownToTiptapJson('::: info\n提示内容\n:::');
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('::: info');
      expect(md).toContain('提示内容');
      expect(md).toContain(':::');
    });
    it('Bilibili 卡片序列化为 [video](url)', () => {
      const url = 'https://www.bilibili.com/video/BV1xx411c7mD';
      const doc = markdownToTiptapJson(`[video](${url})`);
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain(`[video](${url})`);
    });
    it('任务列表序列化为 - [x] / - [ ] 语法', () => {
      const doc = markdownToTiptapJson('- [x] 完成\n- [ ] 未完成');
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('- [x] 完成');
      expect(md).toContain('- [ ] 未完成');
    });
    it('列表项包含多段落时序列化为缩进续行', () => {
      const md = '- 第一段\n\n 第二段';
      const doc = markdownToTiptapJson(md);
      const result = tiptapJsonToMarkdown(doc);
      expect(result).toContain('第一段');
      expect(result).toContain('第二段');
    });
    it('列表项包含嵌套列表时正确序列化', () => {
      const md = '- 外层\n - 内层';
      const doc = markdownToTiptapJson(md);
      const result = tiptapJsonToMarkdown(doc);
      expect(result).toContain('外层');
      expect(result).toContain('内层');
    });
    it('列表项包含代码块等非段落块节点时正确序列化', () => {
      const md = '- 项目\n\n ```js\n console.log(1)\n ```';
      const doc = markdownToTiptapJson(md);
      const result = tiptapJsonToMarkdown(doc);
      expect(result).toContain('项目');
      expect(result).toContain('console.log');
    });
    it('tiptapJsonToMarkdown 接受单个块节点（非 doc）', () => {
      const singleBlock = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '独立段落',
          },
        ],
      };
      const md = tiptapJsonToMarkdown(singleBlock);
      expect(md).toBe('独立段落');
    });
    it('tiptapJsonToMarkdown 空输入返回空字符串', () => {
      expect(tiptapJsonToMarkdown(null as never)).toBe('');
    });
    it('highlight mark 带 color 属性时序列化为 <mark> 标签', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '高亮文本',
                marks: [
                  {
                    type: 'highlight',
                    attrs: { color: 'yellow' },
                  },
                ],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('<mark style="background-color:yellow">');
      expect(md).toContain('</mark>');
      expect(md).toContain('高亮文本');
    });
    it('未知 mark 类型不破坏序列化', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '文本',
                marks: [
                  {
                    type: 'unknownMark',
                  },
                ],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('文本');
    });
    it('未知 inline 节点类型不破坏序列化', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '前',
              },
              {
                type: 'unknownInline',
              },
              {
                type: 'text',
                text: '后',
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('前');
      expect(md).toContain('后');
    });
    it('未知块节点带 content 时递归序列化', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'unknownBlock',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: '嵌套内容',
                  },
                ],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('嵌套内容');
    });
    it('表格节点序列化为 GFM 表格语法', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          {
                            type: 'text',
                            text: '姓名',
                          },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          {
                            type: 'text',
                            text: '年龄',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          {
                            type: 'text',
                            text: '张三',
                          },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          {
                            type: 'text',
                            text: '25',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('姓名');
      expect(md).toContain('年龄');
      expect(md).toContain('张三');
      expect(md).toContain('25');
      expect(md).toContain('---');
    });
    it('空表格序列化为空字符串', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toBe('');
    });
  });
  describe('round-trip 保真（verifyRoundTrip）', () => {
    it('简单段落 round-trip', () => {
      const result = verifyRoundTrip('这是一段简单文本。');
      expect(result.ok).toBe(true);
    });
    it('标题 round-trip', () => {
      const result = verifyRoundTrip('# 一级标题\n\n## 二级标题');
      expect(result.ok).toBe(true);
    });
    it('代码块 round-trip', () => {
      const result = verifyRoundTrip('```python\nprint("hello")\n```');
      expect(result.ok).toBe(true);
    });
    it('Mermaid 块 round-trip', () => {
      const result = verifyRoundTrip('```mermaid\ngraph TD\nA-->B\n```');
      expect(result.ok).toBe(true);
    });
    it('KaTeX 块 round-trip', () => {
      const result = verifyRoundTrip('$$\na^2 + b^2 = c^2\n$$');
      expect(result.ok).toBe(true);
    });
    it('自定义提示块 round-trip', () => {
      const result = verifyRoundTrip('::: warning\n注意危险\n:::');
      expect(result.ok).toBe(true);
    });
    it('Bilibili 卡片 round-trip', () => {
      const result = verifyRoundTrip('[video](https://www.bilibili.com/video/BV1xx411c7mD)');
      expect(result.ok).toBe(true);
    });
    it('任务列表 round-trip', () => {
      const result = verifyRoundTrip('- [x] 已完成\n- [ ] 未完成');
      expect(result.ok).toBe(true);
    });
    it('引用块 round-trip', () => {
      const result = verifyRoundTrip('> 这是引用文本');
      expect(result.ok).toBe(true);
    });
    it('分隔线 round-trip', () => {
      const result = verifyRoundTrip('---');
      expect(result.ok).toBe(true);
    });
    it('行内标记 round-trip（加粗+斜体+代码+链接）', () => {
      const md = '**粗体** 和 *斜体* 和 `代码` 和 [链接](https:// example.com)';
      const result = verifyRoundTrip(md);
      expect(result.ok).toBe(true);
    });
    it('复合文档 round-trip', () => {
      const md = [
        '# 标题',
        '',
        '一段正文，含 **加粗** 和 $E=mc^2$ 公式。',
        '',
        '```mermaid',
        'graph TD',
        'A-->B',
        '```',
        '',
        '::: info',
        '提示信息',
        ':::',
        '',
        '- [x] 任务一',
        '- [ ] 任务二',
      ].join('\n');
      const result = verifyRoundTrip(md);
      expect(result.ok).toBe(true);
    });
  });

  describe('边界分支覆盖（coverage补全）', () => {
    it('tiptapJsonToMarkdown: listItem 无 content 返回空字符串', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              { type: 'listItem' }, // no content
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toBe('- ');
    });

    it('tiptapJsonToMarkdown: taskItem 无 content 返回空字符串', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: false } }, // no content
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toBe('- [ ] ');
    });

    it('tiptapJsonToMarkdown: 未知节点无 content 返回空字符串', () => {
      const node = { type: 'unknownAtomNode' };
      const result = tiptapJsonToMarkdown(node);
      expect(result).toBe('');
    });

    it('tiptapJsonToMarkdown: 未知节点有 content 时递归序列化子节点', () => {
      const node = {
        type: 'unknownWrapper',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '内嵌内容' }] }],
      };
      const result = tiptapJsonToMarkdown(node);
      expect(result).toContain('内嵌内容');
    });

    it('tiptapJsonToMarkdown: table cell align 为 right 时产生 ---: 对齐标记', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    attrs: { align: 'right' },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col' }] }],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    attrs: { align: 'right' },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Val' }] }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('---:');
    });

    it('tiptapJsonToMarkdown: table cell align 为默认时产生 --- 对齐标记', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    attrs: { align: 'unknown' }, // triggers the else -> '---'
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col' }] }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('---');
    });

    it('serializeInline: 非 text/katexInline 节点有 content 时递归序列化', () => {
      // 直接构造一个带 content 的段落节点（非文本节点走 else 分支）
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'unknownInline', // triggers serializeInline else branch
                content: [{ type: 'text', text: '递归文本' }],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('递归文本');
    });

    it('tiptapJsonToMarkdown: customAlert 无 content 返回仅语法行', () => {
      const node = { type: 'customAlert', attrs: { alertType: 'warning' } };
      const result = tiptapJsonToMarkdown(node);
      expect(result).toBe('::: warning\n:::');
    });

    it('tiptapJsonToMarkdown: orderedList 含多行 listItem 时正确缩进续行', () => {
      // covers lines 330-335: inner with \n triggers the lineIdx > 0 path -> '   ' + line
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: '第一行' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: '第二行' }] },
                ],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('1. 第一行');
      expect(md).toContain('第二行');
    });

    it('tiptapJsonToMarkdown: bulletList 含多行 listItem 时正确缩进续行', () => {
      // covers line 345: '  ' + line for lineIdx > 0
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: '项目' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: '续行' }] },
                ],
              },
            ],
          },
        ],
      };
      const md = tiptapJsonToMarkdown(doc);
      expect(md).toContain('- 项目');
      expect(md).toContain('续行');
    });

    it('tiptapJsonToMarkdown: 直接序列化 listItem 节点（无 content）返回空', () => {
      // covers line 351: if (!node.content) return ''
      const result = tiptapJsonToMarkdown({ type: 'listItem' });
      expect(result).toBe('');
    });

    it('tiptapJsonToMarkdown: 直接序列化 taskItem 节点（无 content）返回空', () => {
      // covers line 355: if (!node.content) return ''
      const result = tiptapJsonToMarkdown({ type: 'taskItem' });
      expect(result).toBe('');
    });

    it('tiptapJsonToMarkdown: 直接序列化 listItem 节点（有 content）正确展开', () => {
      // covers line 352: map content
      const result = tiptapJsonToMarkdown({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '列表项' }] }],
      });
      expect(result).toContain('列表项');
    });

    it('tiptapJsonToMarkdown: 直接序列化 taskItem 节点（有 content）正确展开', () => {
      // covers line 356: map content
      const result = tiptapJsonToMarkdown({
        type: 'taskItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '任务项' }] }],
      });
      expect(result).toContain('任务项');
    });

    // ── convertInlineTokens 分支 ──────────────────────────────────
    it('convertInlineTokens: br token 转换为换行文本节点', () => {
      // covers L51-52: token.type === 'br'
      // Markdown two-space line break triggers a br token
      const doc = markdownToTiptapJson('第一行  \n第二行');
      const para = doc.content[0];
      expect(para.type).toBe('paragraph');
      const texts = para.content?.map((n: any) => n.text) || [];
      expect(texts.some((t: string) => t === '\n')).toBe(true);
    });

    it('convertInlineTokens: 未知 inline token 类型走 else fallback', () => {
      // covers L58: else branch using token.raw
      // An escaped character like \* produces a `escape` token type
      const doc = markdownToTiptapJson('text \\* more');
      const para = doc.content[0];
      expect(para.type).toBe('paragraph');
      // Should have at least one text node
      expect(para.content?.some((n: any) => n.type === 'text')).toBe(true);
    });

    // ── markdownToTiptapJson 空输入边界 ───────────────────────────
    it('markdownToTiptapJson: null 输入返回空段落（L214）', () => {
      // covers L214: markdown === null check
      const doc = markdownToTiptapJson(null as unknown as string);
      expect(doc.type).toBe('doc');
      expect(doc.content[0].type).toBe('paragraph');
    });

    it('markdownToTiptapJson: content.length===0 时返回空段落（L222）', () => {
      // covers L222: parsed tokens produce empty content array
      // A horizontal rule after nothing leaves empty paragraphs in some configurations
      // Use the space-only path first to ensure zero-content doc
      const doc = markdownToTiptapJson('   ');
      expect(doc.type).toBe('doc');
      expect(doc.content[0].type).toBe('paragraph');
    });

    // ── serializeInline 特殊分支 ──────────────────────────────────
    it('serializeInline: content 为 undefined 时返回空字符串（L231）', () => {
      // covers L231: if (!content) return ''
      // paragraph with no content array
      const node = { type: 'paragraph' }; // no content
      const result = tiptapJsonToMarkdown(node);
      expect(result).toBe('');
    });

    it('serializeInline: strike mark 正确序列化为 ~~text~~（L244）', () => {
      // covers L244: mark.type === 'strike'
      const node = {
        type: 'paragraph',
        content: [{ type: 'text', text: '删除线', marks: [{ type: 'strike' }] }],
      };
      const result = tiptapJsonToMarkdown(node);
      expect(result).toBe('~~删除线~~');
    });

    it('serializeInline: link mark 正确序列化为 [text](url)（L248）', () => {
      // covers L248: mark.type === 'link'
      const node = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '点击',
            marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
          },
        ],
      };
      const result = tiptapJsonToMarkdown(node);
      expect(result).toBe('[点击](https://example.com)');
    });

    // ── tiptapJsonToMarkdown doc 空 content 分支 ─────────────────
    it('tiptapJsonToMarkdown: doc 节点 content 为空数组时返回空字符串（L271）', () => {
      // covers L271: content.length === 0
      const result = tiptapJsonToMarkdown({ type: 'doc', content: [] });
      expect(result).toBe('');
    });

    // ── blockquote / list 无 content 分支 ────────────────────────
    it('tiptapJsonToMarkdown: blockquote 无 content 返回空字符串（L286）', () => {
      const result = tiptapJsonToMarkdown({ type: 'blockquote' });
      expect(result).toBe('');
    });

    it('tiptapJsonToMarkdown: taskList 无 content 返回空字符串（L317）', () => {
      const result = tiptapJsonToMarkdown({ type: 'taskList' });
      expect(result).toBe('');
    });

    it('tiptapJsonToMarkdown: orderedList 无 content 返回空字符串（L325）', () => {
      const result = tiptapJsonToMarkdown({ type: 'orderedList' });
      expect(result).toBe('');
    });

    it('tiptapJsonToMarkdown: bulletList 无 content 返回空字符串（L339）', () => {
      const result = tiptapJsonToMarkdown({ type: 'bulletList' });
      expect(result).toBe('');
    });

    // ── table 边界分支 ────────────────────────────────────────────
    it('tiptapJsonToMarkdown: table row 无 content 时跳过（L365）', () => {
      // covers L365: if (!row.content) return
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              { type: 'tableRow' }, // no content — triggers L365 guard
            ],
          },
        ],
      };
      const result = tiptapJsonToMarkdown(doc);
      // Should produce a table with empty pipe row
      expect(typeof result).toBe('string');
    });

    it('tiptapJsonToMarkdown: table header align center 产生 :---: 标记（L369）', () => {
      // covers L369: align === 'center' -> ':---:'
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    attrs: { align: 'center' },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C' }] }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = tiptapJsonToMarkdown(doc);
      expect(result).toContain(':---:');
    });
  });
});
