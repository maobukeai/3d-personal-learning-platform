/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, type VNode } from 'vue';
export type FeedbackMessage = string | VNode;
export interface ToastItem {
  id: number;
  message: FeedbackMessage;
  type: 'success' | 'warning' | 'info' | 'error';
  duration: number;
  customClass?: string;
}
export interface NotificationItem {
  id: number;
  title?: string;
  message: FeedbackMessage;
  type: 'success' | 'warning' | 'info' | 'error';
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  duration: number;
  onClick?: () => void;
  customClass?: string;
}
export interface ConfirmItem {
  id: number;
  message: FeedbackMessage;
  title: string;
  type?: 'success' | 'warning' | 'info' | 'error';
  confirmButtonText: string;
  cancelButtonText: string;
  showInput: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}
let nextId = 1;
export const toasts = ref<ToastItem[]>([]);
export const notifications = ref<NotificationItem[]>([]);
export const confirms = ref<ConfirmItem[]>([]);
export function pushToast(item: Omit<ToastItem, 'id'>): number {
  const id = nextId++;
  toasts.value.push({ ...item, id });
  if (item.duration > 0) {
    setTimeout(() => removeToast(id), item.duration);
  }
  return id;
}
export function removeToast(id: number) {
  const idx = toasts.value.findIndex((t) => t.id === id);
  if (idx >= 0) toasts.value.splice(idx, 1);
}
export function pushNotification(item: Omit<NotificationItem, 'id'>): number {
  const id = nextId++;
  notifications.value.push({ ...item, id });
  if (item.duration > 0) {
    setTimeout(() => removeNotification(id), item.duration);
  }
  return id;
}
export function removeNotification(id: number) {
  const idx = notifications.value.findIndex((n) => n.id === id);
  if (idx >= 0) notifications.value.splice(idx, 1);
}
export function pushConfirm(item: Omit<ConfirmItem, 'id'>): number {
  const id = nextId++;
  confirms.value.push({ ...item, id });
  return id;
}
export function removeConfirm(id: number) {
  const idx = confirms.value.findIndex((c) => c.id === id);
  if (idx >= 0) confirms.value.splice(idx, 1);
}
