<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, computed } from 'vue';
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
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';

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
  searchQuery?: string;
}

const _props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const filteredPlans = computed(() => {
  const q = (_props.searchQuery || '').trim().toLowerCase();
  if (!q) return _props.plans;
  return _props.plans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(q) || (plan.displayName || '').toLowerCase().includes(q),
  );
});

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
    ElMessage.warning(t('admin.please_fill_in_the_2'));
    return;
  }
  try {
    if (editingPlan.value) {
      await api.put(`/api/admin/subscription-plans/${editingPlan.value.id}`, planForm.value);
      ElMessage.success(t('admin.plan_has_been_updated'));
    } else {
      await api.post('/api/admin/subscription-plans', planForm.value);
      ElMessage.success(t('admin.plan_created'));
    }
    showPlanDialog.value = false;
    emit('refresh');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('admin.save_failed')));
  }
};

const handleDeletePlan = async (plan: SubscriptionPlan) => {
  if ((plan.subscriberCount || 0) > 0) {
    ElMessage.warning(t('admin.the_plan_still_has', { param_0: plan.subscriberCount || 0 }));
    return;
  }
  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_2', { param_0: plan.displayName || plan.name }),
      t('admin.confirm_deletion_1'),
      {
        confirmButtonText: t('admin.delete'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
      },
    );
    await api.delete(`/api/admin/subscription-plans/${plan.id}`);
    ElMessage.success(t('admin.plan_deleted_1'));
    emit('refresh');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, t('admin.delete_failed')));
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
        v-for="plan in filteredPlans"
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
                  >{{ $t('admin.recommended') }}</span
                >
              </div>
              <div
                class="flex flex-nowrap items-center gap-x-1.5 xs:gap-x-2 mt-2 text-[9px] xs:text-[10px] sm:text-xs text-[var(--text-secondary)] overflow-x-auto scrollbar-hide min-w-0 mobile-row"
              >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><DollarSign class="w-3 h-3 shrink-0" />月付 ￥{{ plan.price
                  }}{{
                    plan.yearlyPrice
                      ? $t('admin.yearly_payment_plan_yearlyprice', {
                          planyearlyPrice: plan.yearlyPrice,
                        })
                      : ''
                  }}</span
                >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><HardDrive class="w-3 h-3 shrink-0" />{{
                    (plan.maxStorage || 0) >= 9999
                      ? t('admin.unlimited')
                      : (plan.maxStorage || 0) + 'GB'
                  }}</span
                >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><Users class="w-3 h-3 shrink-0" />{{
                    (plan.maxTeams || 0) >= 999
                      ? t('admin.unlimited')
                      : (plan.maxTeams || 0) + $t('admin.team')
                  }}</span
                >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><FolderOpen class="w-3 h-3 shrink-0" />{{
                    (plan.maxProjects || 0) >= 9999
                      ? t('admin.unlimited')
                      : (plan.maxProjects || 0) + $t('admin.project')
                  }}</span
                >
                <span class="flex items-center gap-0.5 shrink-0"
                  ><Box class="w-3 h-3 shrink-0" />{{
                    (plan.maxAssets || 0) >= 9999
                      ? t('admin.unlimited')
                      : (plan.maxAssets || 0) + $t('admin.assets_1')
                  }}</span
                >
              </div>
            </div>
          </div>
          <div
            class="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-0 border-[var(--border-base)] shrink-0"
          >
            <span class="text-xs text-[var(--text-muted)]">{{
              $t('admin.plan_subscribers_count', { count: plan.subscriberCount || 0 })
            }}</span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-accent transition-all"
                @click="openEditPlan(plan)"
              >
                <Pencil class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition-all"
                @click="handleDeletePlan(plan)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div
          v-if="plan.features && plan.features.length > 0"
          class="mt-4 pt-4 border-t border-[var(--border-base)]"
        >
          <div class="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-hide mobile-row">
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
    <Modal :show="showPlanDialog" size="lg" glass-card @close="showPlanDialog = false">
      <template #header>
        <div>
          <h3 class="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
            {{ editingPlan ? t('admin.edit_plan') : $t('admin.new_plan') }}
          </h3>
          <p class="text-xs text-slate-400 mt-1">
            {{
              editingPlan
                ? '修改和调整当前订阅方案的计费和配额参数'
                : '配置一个新的系统订阅和计费方案'
            }}
          </p>
        </div>
      </template>

      <div class="space-y-6">
        <div class="grid grid-cols-2 gap-4 mobile-grid">
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.program_logo_english')
            }}</label>
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
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.display_name')
            }}</label>
            <input
              v-model="planForm.displayName"
              type="text"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              :placeholder="$t('admin.e_g_professional_edition')"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mobile-grid">
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.monthly_payment_price')
            }}</label>
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
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.annual_payment_price')
            }}</label>
            <input
              v-model.number="planForm.yearlyPrice"
              type="number"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              :placeholder="$t('admin.if_left_blank_annual')"
            />
          </div>
        </div>

        <div class="grid grid-cols-4 gap-4 mobile-grid">
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.storage_gb')
            }}</label>
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
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.number_of_teams')
            }}</label>
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
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.number_of_items')
            }}</label>
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
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.number_of_assets')
            }}</label>
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

        <div class="grid grid-cols-3 gap-4 mobile-grid">
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.sort_priority')
            }}</label>
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
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.badge_color')
            }}</label>
            <input
              v-model="planForm.badgeColor"
              type="color"
              class="w-full h-12 rounded-2xl border cursor-pointer bg-transparent"
              style="border-color: var(--border-base)"
            />
          </div>
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
              $t('admin.recommended_tag')
            }}</label>
            <button
              type="button"
              class="w-full h-12 rounded-2xl border flex items-center justify-center gap-2 transition-all"
              :class="
                planForm.isPopular
                  ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                  : 'border-[var(--border-base)] text-[var(--text-muted)]'
              "
              style="border-color: planForm.isPopular ? undefined : 'var(--border-base)'"
              @click="planForm.isPopular = !planForm.isPopular"
            >
              <component :is="planForm.isPopular ? Check : X" class="w-4 h-4" />
              <span class="text-xs font-bold">{{
                planForm.isPopular ? $t('admin.recommended') : $t('admin.normal_plan')
              }}</span>
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{{
            $t('admin.features')
          }}</label>
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
              :placeholder="$t('admin.enter_the_function_description')"
              @keyup.enter="addFeature"
            />
            <Button variant="primary" size="sm" @click="addFeature"> 添加 </Button>
          </div>
          <div class="flex flex-wrap gap-2 mt-2">
            <span
              v-for="(feature, idx) in planForm.features"
              :key="idx"
              class="flex items-center gap-1 px-3 py-1 bg-[var(--bg-app)] rounded-lg text-xs text-[var(--text-secondary)]"
            >
              {{ feature }}
              <button
                type="button"
                class="text-slate-400 hover:text-rose-500"
                @click="removeFeature(idx)"
              >
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center gap-3">
          <Button variant="secondary" size="md" @click="showPlanDialog = false"> 取消 </Button>
          <Button variant="primary" size="md" :icon="Save" @click="handleSavePlan">
            {{ editingPlan ? t('admin.save_changes_1') : $t('admin.create_plan') }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>
