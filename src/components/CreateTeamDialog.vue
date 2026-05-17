<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Plus, Users, Check } from 'lucide-vue-next';

import api from '@/utils/api';

const { t } = useI18n();
const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible', 'success']);

const teamName = ref('');
const teamDescription = ref('');
const teamCategory = ref('modeling');
const teamType = ref('public');
const loading = ref(false);

const categories = computed(() => [
  { label: t('categories.modeling'), value: 'modeling' },
  { label: t('categories.rendering'), value: 'rendering' },
  { label: t('categories.animation'), value: 'animation' },
  { label: t('categories.materials'), value: 'materials' },
  { label: t('categories.gameEngine'), value: 'gameEngine' },
]);

const handleClose = () => {
  emit('update:visible', false);
};

const handleCreate = async () => {
  if (!teamName.value) {
    ElMessage.warning(t('team.nameRequired'));
    return;
  }

  loading.value = true;
  try {
    const { data: team } = await api.post('/api/teams', {
      name: teamName.value,
      description: teamDescription.value,
      category: teamCategory.value,
      visibility: teamType.value === 'public' ? 'PUBLIC' : 'PRIVATE',
    });
    ElMessage.success(t('team.createSuccess'));
    emit('success', team); // pass team object so caller can navigate to /team/:id
    handleClose();
    // Reset form
    teamName.value = '';
    teamDescription.value = '';
    teamType.value = 'public';
  } catch (error) {
    ElMessage.error(t('team.createFailed'));
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="t('team.createTitle')"
    width="min(500px, 95%)"
    class="custom-rounded-dialog"
    :show-close="true"
    @update:model-value="(val: any) => emit('update:visible', val)"
  >
    <div class="space-y-4 md:space-y-6 py-2">
      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">{{
          t('team.name')
        }}</label>
        <input
          v-model="teamName"
          type="text"
          :placeholder="t('team.namePlaceholder')"
          class="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-accent focus:ring-4 focus:ring-accent-subtle outline-none transition-all placeholder:text-slate-300"
        />
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">{{
          t('team.description')
        }}</label>
        <textarea
          v-model="teamDescription"
          rows="3"
          :placeholder="t('team.descriptionPlaceholder')"
          class="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-accent focus:ring-4 focus:ring-accent-subtle outline-none transition-all resize-none placeholder:text-slate-300"
        ></textarea>
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">{{
          t('team.category')
        }}</label>
        <el-select
          v-model="teamCategory"
          class="w-full custom-select"
          :placeholder="t('team.categoryPlaceholder')"
        >
          <el-option
            v-for="cat in categories"
            :key="cat.value"
            :label="cat.label"
            :value="cat.value"
          />
        </el-select>
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">{{
          t('team.type')
        }}</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            :class="
              teamType === 'public'
                ? 'border-accent bg-accent-subtle/50'
                : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
            "
            class="flex flex-col items-start p-4 border-2 rounded-2xl transition-all text-left group"
            @click="teamType = 'public'"
          >
            <div class="flex items-center justify-between w-full mb-2">
              <Users
                class="w-5 h-5"
                :class="teamType === 'public' ? 'text-accent' : 'text-slate-400'"
              />
              <div
                v-if="teamType === 'public'"
                class="w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-lg shadow-accent/20"
              >
                <Check class="w-3 h-3 text-white" />
              </div>
            </div>
            <span class="text-sm font-black text-slate-900">{{ t('team.public') }}</span>
          </button>

          <button
            :class="
              teamType === 'private'
                ? 'border-accent bg-accent-subtle/50'
                : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
            "
            class="flex flex-col items-start p-4 border-2 rounded-2xl transition-all text-left group"
            @click="teamType = 'private'"
          >
            <div class="flex items-center justify-between w-full mb-2">
              <Plus
                class="w-5 h-5"
                :class="teamType === 'private' ? 'text-accent' : 'text-slate-400'"
              />
              <div
                v-if="teamType === 'private'"
                class="w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-lg shadow-accent/20"
              >
                <Check class="w-3 h-3 text-white" />
              </div>
            </div>
            <span class="text-sm font-black text-slate-900">{{ t('team.private') }}</span>
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          class="px-6 py-2.5 rounded-full font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          @click="handleClose"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          :disabled="loading"
          class="px-8 py-2.5 rounded-full font-bold text-white bg-accent hover:bg-accent shadow-xl shadow-accent/20 transition-all disabled:opacity-50 active:scale-95"
          @click="handleCreate"
        >
          {{ loading ? t('common.loading') : t('common.confirm') }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped></style>
