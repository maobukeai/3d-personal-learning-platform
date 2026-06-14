<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Shield } from 'lucide-vue-next';

interface EditForm {
  name: string;
  description: string;
  avatarUrl: string;
  visibility: string;
  category: string;
}

const props = defineProps<{
  editForm: EditForm;
  isPersonalSpace: boolean;
  isOwner: boolean;
  isSaving: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:editForm', val: EditForm): void;
  (e: 'update-team'): void;
  (e: 'delete-team'): void;
}>();

const { t: i18nT } = useI18n();

const t = (key: string, ...args: any[]) => {
  const prefixes = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  if (prefixes.some((p) => key.startsWith(p))) {
    return (i18nT as any)(`community.${key}`, ...args);
  }
  return (i18nT as any)(key, ...args);
};

const localEditForm = computed({
  get: () => props.editForm,
  set: (val) => emit('update:editForm', val),
});

const categories = ['建模', '渲染', '动画', '材质', '游戏引擎'];
</script>

<template>
  <div class="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-12 text-left">
      <div class="lg:col-span-1">
        <h3 class="text-xl font-black mb-3" style="color: var(--text-primary)">
          {{ t('teamDetail.basicProfile') }}
        </h3>
        <p class="text-sm text-slate-500 leading-relaxed">
          {{ t('teamDetail.basicProfileDesc') }}
        </p>
      </div>
      <div
        class="lg:col-span-2 space-y-8 bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border shadow-sm"
        style="border-color: var(--border-base)"
      >
        <div class="space-y-3">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{{
            t('teamDetail.teamNameLabel')
          }}</label>
          <input
            v-model="localEditForm.name"
            type="text"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl focus:ring-4 focus:ring-accent/10 outline-none transition-all"
            style="border-color: var(--border-base); color: var(--text-primary)"
          />
        </div>
        <div class="space-y-3">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{{
            t('teamDetail.teamDescLabel')
          }}</label>
          <textarea
            v-model="localEditForm.description"
            rows="4"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl focus:ring-4 focus:ring-accent/10 outline-none transition-all resize-none"
            style="border-color: var(--border-base); color: var(--text-primary)"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-3">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{{
              t('team.category')
            }}</label>
            <el-select
              v-model="localEditForm.category"
              class="w-full custom-select"
              :placeholder="t('team.categoryPlaceholder')"
            >
              <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
            </el-select>
          </div>
          <div v-if="!isPersonalSpace" class="space-y-3">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{{
              t('teamDetail.privacyLabel')
            }}</label>
            <el-select
              v-model="localEditForm.visibility"
              class="w-full custom-select"
              :placeholder="t('teamDetail.visibilityPlaceholder')"
            >
              <el-option :label="t('teamDetail.visibilityPublic')" value="PUBLIC" />
              <el-option :label="t('teamDetail.visibilityPrivate')" value="PRIVATE" />
            </el-select>
          </div>
        </div>
        <div class="flex justify-end pt-4">
          <button
            type="button"
            :disabled="isSaving"
            class="px-10 py-4 bg-accent text-white rounded-2xl font-bold shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 border-none cursor-pointer"
            @click="emit('update-team')"
          >
            {{ isSaving ? t('teamDetail.syncing') : t('teamDetail.saveChanges') }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="!isPersonalSpace"
      class="pt-12 border-t text-left"
      style="border-color: var(--border-base)"
    >
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div class="lg:col-span-1">
          <h3 class="text-xl font-black mb-3 text-rose-500">
            {{ t('teamDetail.dangerZone') }}
          </h3>
          <p class="text-sm text-slate-500 leading-relaxed">
            {{ t('teamDetail.dangerZoneDesc') }}
          </p>
        </div>
        <div
          class="lg:col-span-2 bg-rose-50/50 dark:bg-rose-500/5 p-10 rounded-[2.5rem] border border-rose-100 dark:border-rose-500/20 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div>
            <h4 class="text-lg font-black text-rose-600 mb-1">
              {{ t('teamDetail.dissolveTitle') }}
            </h4>
            <p class="text-sm text-rose-500 opacity-80">
              {{ t('teamDetail.dissolveDesc') }}
            </p>
          </div>
          <button
            v-if="isOwner"
            type="button"
            class="px-10 py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-xl shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all whitespace-nowrap border-none cursor-pointer"
            @click="emit('delete-team')"
          >
            {{ t('teamDetail.dissolveBtn') }}
          </button>
          <div v-else class="flex items-center gap-2 text-rose-400 font-bold text-sm italic">
            <Shield class="w-4 h-4" /> {{ t('teamDetail.dissolveOwnerOnly') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
