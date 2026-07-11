<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from '@/utils/feedbackBridge';
import { Database, Upload, Loader2 } from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import type { ManualStation } from '../AdminManualView.vue';
import FormDialog from '@/components/FormDialog.vue';

const { t } = useI18n();

const visible = defineModel<boolean>({ default: false });

const props = defineProps<{
  station?: ManualStation | null;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const formData = ref({
  name: '',
  displayName: '',
  minPlanPriority: 0,
  description: '',
  iconUrl: '',
  status: 'ACTIVE',
});

function resetForm() {
  formData.value = {
    name: '',
    displayName: '',
    minPlanPriority: 0,
    description: '',
    iconUrl: '',
    status: 'ACTIVE',
  };
}

watch(
  () => props.station,
  (newStation) => {
    if (newStation) {
      formData.value = {
        name: newStation.name,
        displayName: newStation.displayName,
        minPlanPriority: newStation.minPlanPriority,
        description: newStation.description || '',
        iconUrl: newStation.iconUrl || '',
        status: newStation.status,
      };
    } else {
      resetForm();
    }
  },
  { immediate: true },
);

const isUploadingIcon = ref(false);
const handleIconUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning(t('admin.icon_image_size_cannot'));
  }

  try {
    isUploadingIcon.value = true;
    const formDataObj = new FormData();
    formDataObj.append('manual_image', file);
    const { data } = await api.post('/api/admin/manual/upload', formDataObj);
    formData.value.iconUrl = data.url;
    ElMessage.success(t('admin.icon_uploaded_successfully'));
  } catch (error: unknown) {
    logError(error, { operation: 'admin.uploadManualIcon', component: 'ManualStationDialog' });
    ElMessage.error(getApiErrorMessage(error, t('admin.icon_upload_failed')));
  } finally {
    isUploadingIcon.value = false;
    target.value = '';
  }
};

async function submit() {
  if (!formData.value.name) {
    ElMessage.warning(t('admin.please_enter_a_name')); // or appropriate validation
    return;
  }
  if (!formData.value.displayName) {
    ElMessage.warning(t('admin.please_enter_a_display_name'));
    return;
  }

  try {
    if (props.station) {
      await api.put(`/api/admin/manual/stations/${props.station.id}`, formData.value);
      ElMessage.success(t('admin.update_successful'));
    } else {
      await api.post('/api/admin/manual/stations', formData.value);
      ElMessage.success(t('admin.manual_resource_station_created'));
    }
    visible.value = false;
    emit('saved');
  } catch (e: unknown) {
    ElMessage.error(
      getApiErrorMessage(e, props.station ? t('admin.update_failed') : t('admin.creation_failed')),
    );
  }
}
</script>

<template>
  <FormDialog
    :visible="visible"
    :title="station ? $t('admin.edit_manual_resource_site') : $t('admin.create_a_manual_resource')"
    :confirm-text="station ? $t('admin.save_changes') : $t('admin.create_resource_site')"
    @update:visible="visible = $event"
    @cancel="
      () => {
        visible = false;
        resetForm();
      }
    "
    @submit="submit"
  >
    <div class="space-y-4">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >{{
            station ? $t('admin.english_logo_as_the') : $t('admin.english_logo_letters_underscores')
          }}</label
        >
        <input
          v-model="formData.name"
          type="text"
          :placeholder="$t('admin.such_as_c4d_assets')"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        />
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >{{ $t('admin.display_name') }}</label
        >
        <input
          v-model="formData.displayName"
          type="text"
          :placeholder="$t('admin.such_as_cinema_4d')"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        />
      </div>
      <div v-if="station">
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >{{ $t('admin.status') }}</label
        >
        <Select v-model="formData.status" class="w-full" size="large">
          <SelectOption value="ACTIVE" :label="$t('admin.enable')" />
          <SelectOption value="DISABLED" :label="$t('admin.disable')" />
        </Select>
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >{{ $t('admin.membership_restrictions') }}</label
        >
        <Select v-model="formData.minPlanPriority" class="w-full" size="large">
          <SelectOption :value="0" :label="$t('admin.free_users_and_above')" />
          <SelectOption :value="1" :label="$t('admin.standard_member_and_above')" />
          <SelectOption :value="2" :label="$t('admin.professional_member_and_above')" />
          <SelectOption :value="3" :label="$t('admin.diamond_members_and_above')" />
        </Select>
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >{{ $t('admin.site_icon_1_1') }}</label
        >
        <div class="flex items-center gap-4 mobile-row">
          <div
            class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
          >
            <img
              v-if="formData.iconUrl"
              alt=""
              :src="getAssetUrl(formData.iconUrl)"
              class="w-full h-full object-cover"
            />
            <Database v-else class="w-6 h-6 text-slate-400" />

            <label
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
            >
              <Upload v-if="!isUploadingIcon" class="w-5 h-5 text-white" />
              <Loader2 v-else class="w-5 h-5 text-white animate-spin" />
              <input type="file" accept="image/*" class="hidden" @change="handleIconUpload" />
            </label>
          </div>
          <div class="flex-1 space-y-1.5">
            <input
              v-model="formData.iconUrl"
              type="text"
              :placeholder="$t('admin.or_enter_the_web')"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
            <p class="text-[10px] text-slate-400 leading-none">
              推荐尺寸 128x128px，支持 PNG/JPG/WebP，大小不超过 5MB
            </p>
          </div>
        </div>
      </div>
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >{{ $t('admin.description_information') }}</label
        >
        <textarea
          v-model="formData.description"
          rows="3"
          :placeholder="$t('admin.give_a_brief_introduction')"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm resize-none"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
        ></textarea>
      </div>
    </div>
  </FormDialog>
</template>
