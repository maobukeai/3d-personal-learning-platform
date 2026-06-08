import { ElMessageBox } from 'element-plus';

export const useConfirmDialog = () => {
  const confirm = (message: string, title = '警告', type: 'success' | 'warning' | 'info' | 'error' = 'warning') => {
    return ElMessageBox.confirm(message, title, {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type,
    });
  };

  return {
    confirm,
  };
};
