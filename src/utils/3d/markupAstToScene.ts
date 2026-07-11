import * as THREE from 'three';

export interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface SceneNodeOptions {
  depth?: number;
  yPosition?: number;
}

const NODE_HEIGHT = 2;
const HEADING_SCALE: Record<string, number> = {
  h1: 1.5,
  h2: 1.25,
  h3: 1.0,
  h4: 0.875,
  h5: 0.75,
  h6: 0.625,
};

export function tiptapJsonToWebGLScene(json: TiptapNode): THREE.Group {
  const root = new THREE.Group();
  root.name = 'MarkupScene';
  let yOffset = 0;
  for (const node of json.content ?? []) {
    const mesh = convertNode(node, { yPosition: yOffset });
    if (mesh) {
      root.add(mesh);
      yOffset -= NODE_HEIGHT;
    }
  }
  return root;
}

function convertNode(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D | null {
  switch (node.type) {
    case 'heading':
      return convertHeading(node, opts);
    case 'paragraph':
      return convertParagraph(node, opts);
    case 'codeBlock':
      return convertCodeBlock(node, opts);
    case 'mermaidBlock':
      return convertMermaidBlock(node, opts);
    case 'katexBlock':
      return convertKatexBlock(node, opts);
    case 'customAlert':
      return convertCustomAlert(node, opts);
    case 'blockquote':
      return convertBlockquote(node, opts);
    case 'horizontalRule':
      return convertHorizontalRule(opts);
    case 'bulletList':
    case 'orderedList':
      return convertList(node, opts);
    case 'table':
      return convertTable(node, opts);
    default:
      return convertParagraph(node, opts);
  }
}

function createTextPlane(
  text: string,
  opts: SceneNodeOptions & { scale?: number; color?: number },
): THREE.Mesh {
  const scale = opts.scale ?? 1.0;
  const color = opts.color ?? 0xffffff;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallbackGeo = new THREE.PlaneGeometry(4 * scale, 1 * scale);
    const fallbackMat = new THREE.MeshBasicMaterial({ color });
    const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
    fallbackMesh.position.y = opts.yPosition ?? 0;
    return fallbackMesh;
  }
  const fontSize = 48 * scale;
  ctx.font = `${fontSize}px Inter, sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = Math.max(256, metrics.width + 40);
  canvas.height = fontSize * 2;
  ctx.font = `${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const geometry = new THREE.PlaneGeometry(canvas.width / 100, canvas.height / 100);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = opts.yPosition ?? 0;
  return mesh;
}

function convertHeading(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  const level = Number(node.attrs?.level ?? 1);
  const scale = HEADING_SCALE[`h${level}`] ?? 1.0;
  const text = extractText(node);
  return createTextPlane(text, { ...opts, scale, color: 0xf5792a });
}

function convertParagraph(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  const text = extractText(node) || '[空段落]';
  return createTextPlane(text, { ...opts, scale: 0.75, color: 0xcccccc });
}

function convertCodeBlock(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  const text = extractText(node);
  const group = new THREE.Group();
  const panelGeo = new THREE.PlaneGeometry(8, Math.max(1, text.split('\n').length * 0.3));
  const panelMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a2e,
    transparent: true,
    opacity: 0.85,
  });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.y = opts.yPosition ?? 0;
  group.add(panel);
  const textMesh = createTextPlane(text, { ...opts, scale: 0.6, color: 0x00ff88 });
  textMesh.position.z = 0.01;
  group.add(textMesh);
  return group;
}

function convertMermaidBlock(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  void node;
  const geo = new THREE.PlaneGeometry(6, 3);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = opts.yPosition ?? 0;
  mesh.name = 'MermaidBlock';
  return mesh;
}

function convertKatexBlock(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  void node;
  const geo = new THREE.PlaneGeometry(4, 1.5);
  const mat = new THREE.MeshBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = opts.yPosition ?? 0;
  mesh.name = 'KatexBlock';
  return mesh;
}

function convertCustomAlert(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  const alertType = (node.attrs?.alertType as string) ?? 'info';
  const colorMap: Record<string, number> = {
    info: 0x4a9eff,
    warning: 0xf5a623,
    error: 0xe74c3c,
    success: 0x27ae60,
  };
  const color = colorMap[alertType] ?? 0x4a9eff;
  const text = extractText(node);
  const group = new THREE.Group();
  const barGeo = new THREE.BoxGeometry(0.1, 1.5, 0.05);
  const barMat = new THREE.MeshBasicMaterial({ color });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(-4, opts.yPosition ?? 0, 0);
  group.add(bar);
  const textMesh = createTextPlane(text, { ...opts, scale: 0.7, color });
  group.add(textMesh);
  return group;
}

function convertBlockquote(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  const text = extractText(node);
  const group = new THREE.Group();
  const barGeo = new THREE.BoxGeometry(0.08, 1.2, 0.03);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xf5792a, transparent: true, opacity: 0.6 });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.set(-3.5, opts.yPosition ?? 0, 0);
  group.add(bar);
  const textMesh = createTextPlane(text, { ...opts, scale: 0.7, color: 0xaaaaaa });
  textMesh.position.x = -3;
  group.add(textMesh);
  return group;
}

function convertHorizontalRule(opts: SceneNodeOptions): THREE.Object3D {
  const geo = new THREE.PlaneGeometry(8, 0.05);
  const mat = new THREE.MeshBasicMaterial({ color: 0x444444 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = opts.yPosition ?? 0;
  return mesh;
}

function convertList(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  const group = new THREE.Group();
  group.position.y = opts.yPosition ?? 0;
  let itemY = 0;
  const items = node.content ?? [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prefix = node.type === 'orderedList' ? `${i + 1}. ` : '• ';
    const text = prefix + extractText(item);
    const mesh = createTextPlane(text, { yPosition: itemY, scale: 0.7, color: 0xcccccc });
    group.add(mesh);
    itemY -= 0.5;
  }
  return group;
}

function convertTable(node: TiptapNode, opts: SceneNodeOptions): THREE.Object3D {
  const group = new THREE.Group();
  group.position.y = opts.yPosition ?? 0;
  group.name = 'Table';
  const rows = node.content ?? [];
  const rowCount = rows.length;
  const colCount = rows[0]?.content?.length ?? 0;
  if (rowCount > 0 && colCount > 0) {
    const gridGeo = new THREE.PlaneGeometry(colCount * 2, rowCount * 0.8);
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    group.add(grid);
  }
  return group;
}

function extractText(node: TiptapNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(extractText).join('');
}
