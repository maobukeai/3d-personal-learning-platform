import type { SmartSheetItem } from '../types/sheet';

export function useSheetExport() {
  const exportAsJSON = (items: SmartSheetItem[]) => {
    const dataStr = JSON.stringify(items, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-sheet-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = (items: SmartSheetItem[]) => {
    const headers = ['ID', '标题', '分类', '状态', '优先级', '时长(分钟)', '日期', '标签', '备注'];
    const rows = items.map((item) => [
      item.id,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${(item.category || '').replace(/"/g, '""')}"`,
      item.status,
      item.priority,
      item.durationMinutes || 0,
      item.dueDate || '',
      `"${(item.tags || []).join(',')}"`,
      `"${(item.content || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-sheet-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFromJSON = (file: File): Promise<SmartSheetItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (Array.isArray(parsed)) {
            resolve(parsed as SmartSheetItem[]);
          } else {
            reject(new Error('JSON 文件校验失败：内容不是数组格式'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('文件读取错误'));
      reader.readAsText(file);
    });
  };

  return {
    exportAsJSON,
    exportAsCSV,
    importFromJSON,
  };
}
