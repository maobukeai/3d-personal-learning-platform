import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { tiptapJsonToWebGLScene, type TiptapNode } from '../markupAstToScene';

describe('tiptapJsonToWebGLScene', () => {
  it('should create an empty group for empty content', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [],
    };
    const scene = tiptapJsonToWebGLScene(doc);
    expect(scene).toBeInstanceOf(THREE.Group);
    expect(scene.name).toBe('MarkupScene');
    expect(scene.children.length).toBe(0);
  });

  it('should parse headings with appropriate scale and level properties', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Heading 1' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Heading 2' }],
        },
      ],
    };
    const scene = tiptapJsonToWebGLScene(doc);
    expect(scene.children.length).toBe(2);
    expect(scene.children[0]).toBeInstanceOf(THREE.Mesh);
    expect(scene.children[1]).toBeInstanceOf(THREE.Mesh);
  });

  it('should convert paragraph node correctly', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello paragraph' }],
        },
      ],
    };
    const scene = tiptapJsonToWebGLScene(doc);
    expect(scene.children.length).toBe(1);
    expect(scene.children[0]).toBeInstanceOf(THREE.Mesh);
  });

  it('should convert codeBlock correctly', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'javascript' },
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
      ],
    };
    const scene = tiptapJsonToWebGLScene(doc);
    expect(scene.children.length).toBe(1);
    expect(scene.children[0]).toBeInstanceOf(THREE.Group);
  });

  it('should convert customAlert correctly', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [
        {
          type: 'customAlert',
          attrs: { alertType: 'warning' },
          content: [{ type: 'text', text: 'This is a warning' }],
        },
      ],
    };
    const scene = tiptapJsonToWebGLScene(doc);
    expect(scene.children.length).toBe(1);
    expect(scene.children[0]).toBeInstanceOf(THREE.Group);
  });

  it('should convert bulletList and orderedList correctly', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }],
            },
          ],
        },
      ],
    };
    const scene = tiptapJsonToWebGLScene(doc);
    expect(scene.children.length).toBe(1);
    expect(scene.children[0]).toBeInstanceOf(THREE.Group);
    expect(scene.children[0].children.length).toBe(2);
  });

  it('should convert horizontalRule correctly', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [
        {
          type: 'horizontalRule',
        },
      ],
    };
    const scene = tiptapJsonToWebGLScene(doc);
    expect(scene.children.length).toBe(1);
    expect(scene.children[0]).toBeInstanceOf(THREE.Mesh);
  });

  it('should convert table correctly', () => {
    const doc: TiptapNode = {
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
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1' }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const scene = tiptapJsonToWebGLScene(doc);
    expect(scene.children.length).toBe(1);
    expect(scene.children[0]).toBeInstanceOf(THREE.Group);
    expect(scene.children[0].name).toBe('Table');
  });
});
