<script setup lang="ts">
import { ref } from 'vue';
import {
  CreditCard,
  Pencil,
  Trash2,
  Users,
  Zap,
  Crown,
  Check,
  X,
  DollarSign,
  HardDrive,
  FolderOpen,
  Box,
  Save,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getApiErrorMessage } from '@/utils/error';
import api from '@/utils/api';

interface SubscriptionPlan {
  id: string;
  name: string;
  displayName?: string | null;
  price?: number;
  yearlyPrice?: number | null;
  interval?: string;
  features?: string[];
  maxStorage?: number;
  maxTeams?: number;
  maxProjects?: number | null;
  maxAssets?: number | null;
  priority?: number | null;
  isPopular?: boolean | null;
  badgeColor?: string | null;
  subscriberCount?: number;
}

interface Props {
  plans: SubscriptionPlan[];
  isLoading: boolean;
}

const _props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const showPlanDialog = ref(false);
const editingPlan = ref<SubscriptionPlan | null>(null);
const newFeature = ref('');

const defaultPlanForm = {
  name: '',
  displayName: '',
  price: 0,
  yearlyPrice: 0,
  interval: 'MONTHLY',
  features: [] as string[],
  maxStorage: 1,
  maxTeams: 1,
  maxProjects: 5,
  maxAssets: 50,
  priority: 0,
  isPopular: false,
  badgeColor: '#8b5cf6',
};

const planForm = ref({ ...defaultPlanForm });

const addFeature = () => {
  if (!newFeature.value.trim()) return;
  planForm.value.features.push(newFeature.value.trim());
  newFeature.value = '';
};

const removeFeature = (index: number) => {
  planForm.value.features.splice(index, 1);
};

const openCreatePlan = () => {
  editingPlan.value = null;
  planForm.value = { ...defaultPlanForm, features: [] };
  showPlanDialog.value = true;
};

const openEditPlan = (plan: SubscriptionPlan) => {
  editingPlan.value = plan;
  planForm.value = {
    name: plan.name,
    displayName: plan.displayName || '',
    price: plan.price || 0,
    yearlyPrice: plan.yearlyPrice || 0,
    interval: plan.interval || 'MONTHLY',
    features: Array.isArray(plan.features) ? [...plan.features] : [],
    maxStorage: plan.maxStorage || 1,
    maxTeams: plan.maxTeams || 1,
    maxProjects: plan.maxProjects || 5,
    maxAssets: plan.maxAssets || 50,
    priority: plan.priority || 0,
    isPopular: plan.isPopular || false,
    badgeColor: plan.badgeColor || '#8b5cf6',
  };
  showPlanDialog.value = true;
};

defineExpose({ openCreatePlan, openEditPlan });

const handleSavePlan = async () => {
  if (!planForm.value.name) {
    ElMessage.warning('请填写计划名称');
    return;
  }
  try {
    if (editingPlan.value) {
      await api.put(`/api/admin/subscription-plans/${editingPlan.value.id}`, planForm.value);
      ElMessage.success('计划已更新');
    } else {
      await api.post('/api/admin/subscription-plans', planForm.value);
      ElMessage.success('计划已创建');
    }
    showPlanDialog.value = false;
    emit('refresh');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存失败'));
  }
};

const handleDeletePlan = async (plan: SubscriptionPlan) => {
  if ((plan.subscriberCount || 0) > 0) {
    ElMessage.warning(`该计划仍有 ${plan.subscriberCount || 0} 名订阅者，无法删除`);
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${plan.displayName || plan.name} 计划吗？此操作不可恢复。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await api.delete(`/api/admin/subscription-plans/${plan.id}`);
    ElMessage.success('计划已删除');
    emit('refresh');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除失败'));
    }
  }
};

const getPlanIcon = (name: string) => {
  if (name === 'VIP') return Zap;
  if (name === 'SVIP') return Crown;
  return CreditCard;
};
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-200">
    <div class="grid gap-4">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="p-6 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] hover:shadow-lg transition-all"
      >
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div class="flex items-start gap-4">
            <div
              class="p-3 rounded-2xl shrink-0"
              :style="{
                backgroundColor: (plan.badgeColor || '#8b5cf6') + '15',
                color: plan.badgeColor || '#8b5cf6',
              }"
            >
              <component :is="getPlanIcon(plan.name)" class="w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-lg font-black text-[var(--text-primary)]">
                  {{ plan.displayName || plan.name }}
                </h3>
                <span
                  class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  :style="{
                    backgroundColor: (plan.badgeColor || '#8b5cf6') + '15',
                    color: plan.badgeColor || '#8b5cf6',
                  }"
                  >{{ plan.name }}</span
                >
                <span
                  v-if="plan.isPopular"
                  class="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full"
                  >推荐</span
                >
              </div>
              <div
                class="flex flex-nowrap items-center gap-x-1.5 xs:gap-x-2 mt-2 text-[9px] xs:text-[10px] sm:text-xs text-[var(--text-secondary)] overflow-x-auto scrollbar-hide min-w-0"
              >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><DollarSign class="w-3 h-3 shrink-0" />月付 ￥{{ plan.price
                  }}{{ plan.yearlyPrice ? ` / 年付 ￥${plan.yearlyPrice}` : '' }}</span
                >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><HardDrive class="w-3 h-3 shrink-0" />{{
                    (plan.maxStorage || 0) >= 9999 ? '无限' : (plan.maxStorage || 0) + 'GB'
                  }}</span
                >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><Users class="w-3 h-3 shrink-0" />{{
                    (plan.maxTeams || 0) >= 999 ? '无限' : (plan.maxTeams || 0) + '团队'
                  }}</span
                >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><FolderOpen class="w-3 h-3 shrink-0" />{{
                    (plan.maxProjects || 0) >= 9999 ? '无限' : (plan.maxProjects || 0) + '项目'
                  }}</span
                >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><Box class="w-3 h-3 shrink-0" />{{
                    (plan.maxAssets || 0) >= 9999 ? '无限' : (plan.maxAssets || 0) + '资产'
                  }}</span
                >
              </div>
            </div>
          </div>
          <div
            class="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-0 border-[var(--border-base)] shrink-0"
          >
            <span class="text-xs text-[var(--text-muted)]"
              >{{ plan.subscriberCount || 0 }} 订阅者</span
            >
            <div class="flex items-center gap-1">
              <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-accent transition-all" @click="openEditPlan(plan)">
                <Pencil class="w-4 h-4" />
              </button>
              <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition-all" @click="handleDeletePlan(plan)">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div
          v-if="plan.features && plan.features.length > 0"
          class="mt-4 pt-4 border-t border-[var(--border-base)]"
        >
          <div class="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-hide">
            <span
              v-for="(feature, idx) in plan.features"
              :key="idx"
              class="px-2 py-1 bg-[var(--bg-app)] rounded-lg text-[9px] xs:text-[10px] font-medium text-[var(--text-secondary)] shrink-0"
            >
              {{ feature }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Plan Edit/Create Dialog -->
    <Transition name="fade">
      <div v-if="showPlanDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showPlanDialog = false"
        ></div>
        <div
          class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-8 rounded-3xl shadow-2xl space-y-6 bg-[var(--bg-card)]"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-[var(--text-primary)]">
              {{ editingPlan ? '编辑计划' : '新建计划' }}
            </h3>
            <button type="button" class="text-[var(--text-secondary)]" @click="showPlanDialog = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >计划标识 (英文)</label
              >
              <input
                v-model="planForm.name"
                type="text"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="e.g. VIP"
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >显示名称</label
              >
              <input
                v-model="planForm.displayName"
                type="text"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="e.g. 专业版"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >月付价格 (￥)</label
              >
              <input
                v-model.number="planForm.price"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >年付价格 (￥)</label
              >
              <input
                v-model.number="planForm.yearlyPrice"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="留空则不支持年付"
              />
            </div>
          </div>

          <div class="grid grid-cols-4 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >存储 (GB)</label
              >
              <input
                v-model.number="planForm.maxStorage"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >团队数</label
              >
              <input
                v-model.number="planForm.maxTeams"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >项目数</label
              >
              <input
                v-model.number="planForm.maxProjects"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >资产数</label
              >
              <input
                v-model.number="planForm.maxAssets"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >排序优先级</label
              >
              <input
                v-model.number="planForm.priority"
                type="number"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >徽章颜色</label
              >
              <input
                v-model="planForm.badgeColor"
                type="color"
                class="w-full h-12 rounded-2xl border cursor-pointer"
                style="border-color: var(--border-base)"
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >推荐标记</label
              >
              <button
type="button" class="w-full h-12 rounded-2xl border flex items-center justify-center gap-2 transition-all" :class="
                  planForm.isPopular
                    ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                    : 'border-[var(--border-base)] text-[var(--text-muted)]'
                " style="border-color: planForm.isPopular ? undefined : 'var(--border-base)'" @click="planForm.isPopular = !planForm.isPopular">
                <component :is="planForm.isPopular ? Check : X" class="w-4 h-4" />
                <span class="text-xs font-bold">{{ planForm.isPopular ? '推荐' : '普通' }}</span>
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >功能特性</label
            >
            <div class="flex gap-2">
              <input
                v-model="newFeature"
                type="text"
                class="flex-1 px-4 py-2 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="输入功能描述后按回车添加"
                @keyup.enter="addFeature"
              />
              <button type="button" class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold" @click="addFeature">
                添加
              </button>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <span
                v-for="(feature, idx) in planForm.features"
                :key="idx"
                class="flex items-center gap-1 px-3 py-1 bg-[var(--bg-app)] rounded-lg text-xs text-[var(--text-secondary)]"
              >
                {{ feature }}
                <button type="button" class="text-slate-400 hover:text-rose-500" @click="removeFeature(idx)">
                  <X class="w-3 h-3" />
                </button>
              </span>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all" @click="showPlanDialog = false">
              取消
            </button>
            <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-sm bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2" @click="handleSavePlan">
              <Save class="w-4 h-4" /> {{ editingPlan ? '保存更改' : '创建计划' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
