import type { SmartSheetItem } from '../types/sheet';

const STORAGE_KEY = 'smart_sheet_records_v1';

const INITIAL_MOCK_DATA: SmartSheetItem[] = [
  {
    id: 'sheet-1',
    templateType: 'STUDY_LOG',
    title: 'Three.js OffscreenCanvas 性能调优实战',
    category: '3D 渲染',
    tags: ['Three.js', 'Worker', '性能优化'],
    status: 'COMPLETED',
    priority: 'HIGH',
    durationMinutes: 120,
    dueDate: '2026-08-05',
    rating: 5,
    linkUrl: 'https://threejs.org/docs/#api/zh/renderers/WebGLRenderer',
    content: '完成了离线 WebGL 渲染管线迁移，降低主线程卡顿帧。',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'sheet-2',
    templateType: 'PROJECT_MILESTONE',
    title: '多维备忘录 Vue 3.5 模版与无头组件集成',
    category: '前端开发',
    tags: ['Vue3', 'TailwindV4', 'Radix'],
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    durationMinutes: 90,
    dueDate: '2026-08-10',
    rating: 4,
    linkUrl: '',
    content: '依照预设结构完成解耦组件编写，包含 Table、Board、Calendar 视图。',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'sheet-3',
    templateType: 'RESOURCE_INVENTORY',
    title: 'GLTF-Pipeline Draco 10 级模型压缩指令表',
    category: '资产准备',
    tags: ['glTF', 'Draco', '压缩工具'],
    status: 'TODO',
    priority: 'MEDIUM',
    durationMinutes: 45,
    dueDate: '2026-08-12',
    rating: 4,
    linkUrl: 'https://github.com/CesiumGS/gltf-pipeline',
    content: '记录后端自动化压缩与网格解算的最佳 CLI 参数方案。',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class SheetService {
  /**
   * 获取所有备忘录记录（包含初始 Mock 兜底）
   */
  static getLocalItems(): SmartSheetItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK_DATA));
        return INITIAL_MOCK_DATA;
      }
      return JSON.parse(raw) as SmartSheetItem[];
    } catch {
      return INITIAL_MOCK_DATA;
    }
  }

  /**
   * 保存更新全量记录到 LocalStorage
   */
  static saveLocalItems(items: SmartSheetItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  /**
   * 新增单条记录
   */
  static addItem(item: Omit<SmartSheetItem, 'id' | 'createdAt' | 'updatedAt'>): SmartSheetItem {
    const items = this.getLocalItems();
    const newItem: SmartSheetItem = {
      ...item,
      id: 'sheet-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    items.unshift(newItem);
    this.saveLocalItems(items);
    return newItem;
  }

  /**
   * 更新单条记录
   */
  static updateItem(id: string, updates: Partial<SmartSheetItem>): SmartSheetItem | null {
    const items = this.getLocalItems();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = {
      ...items[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalItems(items);
    return items[idx];
  }

  /**
   * 删除记录
   */
  static deleteItem(id: string): boolean {
    const items = this.getLocalItems();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    this.saveLocalItems(filtered);
    return true;
  }
}
