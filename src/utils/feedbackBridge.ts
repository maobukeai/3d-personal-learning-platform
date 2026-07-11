import {
  pushConfirm,
  pushNotification,
  pushToast,
  removeToast,
  type FeedbackMessage,
} from './feedbackStore';

type FeedbackType = 'success' | 'warning' | 'info' | 'error';

export type ElMessageBoxOptions = {
  type?: FeedbackType;
  duration?: number;
  title?: string;
  message?: FeedbackMessage;
  inputValue?: string;
  inputPlaceholder?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  [key: string]: any;
};

type MessageOptions = {
  message?: FeedbackMessage;
  type?: FeedbackType;
  duration?: number;
  showClose?: boolean;
  [key: string]: any;
};

const isConfigObject = (val: any): val is MessageOptions =>
  val &&
  typeof val === 'object' &&
  !val.__v_isVNode &&
  ('message' in val || 'type' in val || 'duration' in val);

const toast = (message: FeedbackMessage | MessageOptions, type: FeedbackType = 'info') => {
  const options = isConfigObject(message)
    ? { ...message, type: message.type ?? type }
    : { message, type };
  const id = pushToast({
    message: options.message ?? '',
    type: options.type,
    duration: options.duration ?? 3000,
  });
  return { close: () => removeToast(id), id };
};

export const ElMessage = Object.assign(toast, {
  success: (message: FeedbackMessage | MessageOptions) => toast(message, 'success'),
  warning: (message: FeedbackMessage | MessageOptions) => toast(message, 'warning'),
  info: (message: FeedbackMessage | MessageOptions) => toast(message, 'info'),
  error: (message: FeedbackMessage | MessageOptions) => toast(message, 'error'),
});

const openConfirm = (
  message: FeedbackMessage,
  title: string,
  options: ElMessageBoxOptions = {},
  input = false,
) =>
  new Promise<string | undefined>((resolve, reject) => {
    pushConfirm({
      message,
      title,
      type: options.type ?? 'warning',
      confirmButtonText: options.confirmButtonText ?? '确定',
      cancelButtonText: options.cancelButtonText ?? '取消',
      showInput: input,
      inputValue: options.inputValue,
      inputPlaceholder: options.inputPlaceholder,
      resolve,
      reject,
    });
  });

export const ElMessageBox = {
  confirm: (message: FeedbackMessage, title: string, options?: ElMessageBoxOptions) =>
    openConfirm(message, title, options),
  prompt: async (message: FeedbackMessage, title: string, options?: ElMessageBoxOptions) => ({
    value: await openConfirm(message, title, options, true),
  }),
  alert: (message: FeedbackMessage, title: string, options?: ElMessageBoxOptions) =>
    new Promise<void>((resolve) => {
      pushConfirm({
        message,
        title,
        type: options?.type ?? 'info',
        confirmButtonText: options?.confirmButtonText ?? '确定',
        cancelButtonText: '',
        showInput: false,
        resolve: () => resolve(),
        reject: () => resolve(),
      });
    }),
};

export const ElNotification = (options: {
  title?: string;
  message?: FeedbackMessage;
  type?: FeedbackType;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  duration?: number;
  customClass?: string;
  dangerouslyUseHTMLString?: boolean;
  onClick?: () => void;
  [key: string]: any;
}) => {
  const id = pushNotification({
    title: options.title,
    message: options.message ?? '',
    type: options.type ?? 'info',
    position: options.position ?? 'top-right',
    duration: options.duration ?? 4500,
    customClass: options.customClass,
  });
  return { close: () => undefined, id };
};
