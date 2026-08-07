import type { CustomSheetTable } from '../types/sheet';

export const PRESET_TABLE_TEMPLATES: CustomSheetTable[] = [
  {
    id: 'tbl-daily-log',
    title: '日常随记与照片墙',
    icon: 'BookOpen',
    columns: [
      { id: 'col-date', name: '日期', type: 'date', width: 130 },
      { id: 'col-photo', name: '📸 照片记录', type: 'image', width: 110 },
      { id: 'col-title', name: '今天的事项/心得', type: 'text', width: 200 },
      {
        id: 'col-mood',
        name: '心情度',
        type: 'select',
        width: 120,
        options: [
          { id: 'opt-happy', label: '😊 愉悦', color: 'emerald' },
          { id: 'opt-calm', label: '😌 平静', color: 'blue' },
          { id: 'opt-tired', label: '😫 疲惫', color: 'amber' },
          { id: 'opt-excited', label: '🔥 亢奋', color: 'rose' },
        ],
      },
      { id: 'col-star', name: '当日评分', type: 'rating', width: 140 },
      {
        id: 'col-tags',
        name: '标签分类',
        type: 'multi-select',
        width: 160,
        options: [
          { id: 'tag-life', label: '生活', color: 'purple' },
          { id: 'tag-study', label: '学习', color: 'blue' },
          { id: 'tag-sport', label: '运动', color: 'emerald' },
          { id: 'tag-work', label: '工作', color: 'cyan' },
        ],
      },
      { id: 'col-done', name: '打卡', type: 'checkbox', width: 80 },
      { id: 'col-detail', name: '详细说明', type: 'rich-text', width: 180 },
    ],
    rows: [
      {
        id: 'row-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cells: {
          'col-date': new Date().toISOString().slice(0, 10),
          'col-photo':
            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=300&auto=format&fit=crop&q=60',
          'col-title': '完成 Three.js 粒子管线重构',
          'col-mood': 'opt-happy',
          'col-star': 5,
          'col-tags': ['tag-study', 'tag-work'],
          'col-done': true,
          'col-detail': '效果符合预期，渲染帧率保持在 60FPS。',
        },
      },
    ],
  },
  {
    id: 'tbl-habits',
    title: '习惯打卡与截图',
    icon: 'CheckSquare',
    columns: [
      { id: 'col-date', name: '打卡日期', type: 'date', width: 130 },
      { id: 'col-photo', name: '📸 打卡凭证', type: 'image', width: 110 },
      { id: 'col-habit', name: '打卡项目', type: 'text', width: 180 },
      {
        id: 'col-category',
        name: '习惯类别',
        type: 'select',
        width: 120,
        options: [
          { id: 'cat-health', label: '健康作息', color: 'emerald' },
          { id: 'cat-mind', label: '冥想阅读', color: 'purple' },
          { id: 'cat-skill', label: '3D/代码练习', color: 'blue' },
        ],
      },
      { id: 'col-status', name: '已完成', type: 'checkbox', width: 80 },
      { id: 'col-minutes', name: '专注时长(分)', type: 'number', width: 110 },
      { id: 'col-note', name: '感受小结', type: 'rich-text', width: 200 },
    ],
    rows: [
      {
        id: 'h-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cells: {
          'col-date': new Date().toISOString().slice(0, 10),
          'col-photo': '',
          'col-habit': '早起水 + 20分钟Shader数学学习',
          'col-category': 'cat-skill',
          'col-status': true,
          'col-minutes': 45,
          'col-note': '理解了 Raymarching 光线步进算法。',
        },
      },
    ],
  },
];
