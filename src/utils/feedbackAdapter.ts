import { ElMessage, ElMessageBox, ElNotification } from '@/utils/feedbackBridge';
import type { ElMessageBoxOptions } from '@/utils/feedbackBridge';

interface ToastFunction {
  (options: any): any;
  success(options: string | any): any;
  warning(options: string | any): any;
  info(options: string | any): any;
  error(options: string | any): any;
}

const toastFn: any = (options: any) => {
  return ElMessage(options);
};

toastFn.success = (options: string | any) => {
  const config = typeof options === 'string' ? { message: options } : options;
  return ElMessage({
    ...config,
    type: 'success',
    customClass: `glass-toast glass-toast--success ${config.customClass || ''}`,
  });
};

toastFn.warning = (options: string | any) => {
  const config = typeof options === 'string' ? { message: options } : options;
  return ElMessage({
    ...config,
    type: 'warning',
    customClass: `glass-toast glass-toast--warning ${config.customClass || ''}`,
  });
};

toastFn.info = (options: string | any) => {
  const config = typeof options === 'string' ? { message: options } : options;
  return ElMessage({
    ...config,
    type: 'info',
    customClass: `glass-toast glass-toast--info ${config.customClass || ''}`,
  });
};

toastFn.error = (options: string | any) => {
  const config = typeof options === 'string' ? { message: options } : options;
  return ElMessage({
    ...config,
    type: 'error',
    customClass: `glass-toast glass-toast--error ${config.customClass || ''}`,
  });
};

export const toast = toastFn as ToastFunction;

export const notify = (options: {
  title?: string;
  message: string;
  type?: 'success' | 'warning' | 'info' | 'error';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  duration?: number;
}) => {
  return ElNotification({
    title: options.title,
    message: options.message,
    type: options.type || 'info',
    position: options.position || 'top-right',
    duration: options.duration !== undefined ? options.duration : 4500,
    customClass: `glass-notification glass-notification--${options.type || 'info'}`,
  });
};

export const confirm = async (
  message: string,
  title: string = '提示',
  options: ElMessageBoxOptions = {},
): Promise<boolean> => {
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'glass-confirm-box',
      ...options,
    });
    return true;
  } catch {
    return false;
  }
};

export const messageBox = {
  confirm(message: string, title: string = '提示', options: ElMessageBoxOptions = {}) {
    return ElMessageBox.confirm(message, title, {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'glass-confirm-box',
      ...options,
    });
  },
  prompt(message: string, title: string = '提示', options: ElMessageBoxOptions = {}) {
    return ElMessageBox.prompt(message, title, {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      customClass: 'glass-confirm-box',
      ...options,
    });
  },
  alert(message: string, title: string = '提示', options: ElMessageBoxOptions = {}) {
    return ElMessageBox.alert(message, title, {
      confirmButtonText: '确定',
      customClass: 'glass-confirm-box',
      ...options,
    });
  },
};
