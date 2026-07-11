<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from '@/utils/feedbackBridge';
import { Plus, Users, Check } from 'lucide-vue-next';
import api from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import { useSystemStore } from '@/stores/system';

const { t } = useI18n();
const _props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible', 'success']);

const systemStore = useSystemStore();

const teamName = ref('');
const teamDescription = ref('');
const teamCategory = ref(systemStore.settings.TEAM_CATEGORIES[0] || '');
const teamType = ref('public');
const loading = ref(false);

const categories = computed(() =>
  systemStore.settings.TEAM_CATEGORIES.map((cat) => ({
    label: cat,
    value: cat,
  })),
);

watch(
  () => systemStore.settings.TEAM_CATEGORIES,
  (newCats) => {
    if (
      newCats &&
      newCats.length > 0 &&
      (!teamCategory.value || !newCats.includes(teamCategory.value))
    ) {
      teamCategory.value = newCats[0];
    }
  },
  { immediate: true },
);

const handleClose = () => {
  emit('update:visible', false);
};

const handleCreate = async () => {
  if (!teamName.value || !teamName.value.trim()) {
    ElMessage.warning(t('team.nameRequired'));
    return;
  }

  loading.value = true;
  try {
    const { data: team } = await api.post('/api/teams', {
      name: teamName.value.trim(),
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
  } catch {
    ElMessage.error(t('team.createFailed'));
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <Modal :show="visible" :title="t('team.createTitle')" size="md" @close="handleClose">
    <div class="space-y-4 md:space-y-6 py-2 text-left">
      <Input
        v-model="teamName"
        type="text"
        :label="t('team.name')"
        :placeholder="t('team.namePlaceholder')"
        input-class="!px-5 !py-3 !rounded-2xl"
      />

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">{{
          t('team.description')
        }}</label>
        <textarea
          v-model="teamDescription"
          rows="3"
          :placeholder="t('team.descriptionPlaceholder')"
          class="w-full px-5 py-3 rounded-2xl glass-input outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
        ></textarea>
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">{{
          t('team.category')
        }}</label>
        <Select
          v-model="teamCategory"
          class="w-full custom-select"
          :placeholder="t('team.categoryPlaceholder')"
        >
          <SelectOption
            v-for="cat in categories"
            :key="cat.value"
            :label="cat.label"
            :value="cat.value"
          />
        </Select>
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">{{
          t('team.type')
        }}</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            :class="
              teamType === 'public'
                ? 'border-accent bg-accent/10'
                : 'border-white/10 bg-white/5 dark:bg-white/5 hover:border-white/20'
            "
            class="flex flex-col items-start p-4 border rounded-2xl transition-all text-left group cursor-pointer"
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
            <span class="text-sm font-black text-slate-900 dark:text-white">{{
              t('team.public')
            }}</span>
          </button>

          <button
            type="button"
            :class="
              teamType === 'private'
                ? 'border-accent bg-accent/10'
                : 'border-white/10 bg-white/5 dark:bg-white/5 hover:border-white/20'
            "
            class="flex flex-col items-start p-4 border rounded-2xl transition-all text-left group cursor-pointer"
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
            <span class="text-sm font-black text-slate-900 dark:text-white">{{
              t('team.private')
            }}</span>
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="secondary"
          class="!px-6 !py-2.5 !rounded-full font-bold"
          @click="handleClose"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="primary"
          :loading="loading"
          class="!px-8 !py-2.5 !rounded-full font-bold shadow-xl shadow-accent/20 hover:scale-105 transition-all"
          @click="handleCreate"
        >
          {{ t('common.confirm') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped></style>
