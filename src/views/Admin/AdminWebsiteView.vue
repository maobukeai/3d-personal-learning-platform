<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Save, ExternalLink } from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import AdminHeader from './components/AdminHeader.vue';

const loading = ref(false);
const saving = ref(false);
const mirrors = ref<{ id: string; displayName: string }[]>([]);
const form = ref({
  eyebrow: 'PERSONAL LEARNING PLATFORM',
  title: '把每一次学习，\n变成看得见的成长。',
  subtitle: '一个将课程、资源、3D 创作与协作串联起来的个人学习空间。更专注，也更自由。',
  featuredMirrorId: null as string | null,
});

const officialSiteUrl =
  import.meta.env.VITE_OFFICIAL_SITE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '/');

const load = async () => {
  loading.value = true;
  try {
    const [homeRes, mirrorsRes] = await Promise.all([
      api.get('/api/admin/website/home'),
      api.get('/api/admin/mirror/sources'),
    ]);
    form.value = { ...form.value, ...homeRes.data };
    mirrors.value = mirrorsRes.data || [];
  } catch {
    ElMessage.error('官网配置加载失败');
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  saving.value = true;
  try {
    await api.put('/api/admin/website/home', form.value);
    ElMessage.success('官网首页已保存');
  } catch {
    ElMessage.error('官网配置保存失败');
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div class="h-full w-full flex flex-col min-w-0 bg-[var(--bg-main)]">
    <!-- Main settings area aligned with standard dashboard layouts -->
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
      <!-- Admin Header with action buttons placed in default slot -->
      <AdminHeader title="官网运营" :show-search="false">
        <a class="preview-link" :href="officialSiteUrl" target="_blank" rel="noopener">
          预览官网 <ExternalLink :size="14" />
        </a>
        <Button
          variant="primary"
          size="sm"
          :loading="saving"
          :icon="Save"
          class="!h-7.5 !text-xs !px-2.5"
          @click="save"
        >
          保存发布
        </Button>
      </AdminHeader>

      <Card class="max-w-2xl border-base bg-card shadow-sm" :aria-busy="loading">
        <div class="website-admin__note">
          首页采用简约玻璃视觉。此处修改会在官网下一次请求时生效。
        </div>

        <div class="space-y-4">
          <label class="form-field-label">
            眉题
            <input v-model="form.eyebrow" maxlength="80" class="form-input" />
          </label>

          <label class="form-field-label">
            主标题
            <textarea v-model="form.title" rows="3" maxlength="160" class="form-textarea" />
          </label>

          <label class="form-field-label">
            介绍文案
            <textarea v-model="form.subtitle" rows="4" maxlength="300" class="form-textarea" />
          </label>

          <label class="form-field-label">
            展示镜像源
            <select v-model="form.featuredMirrorId" class="form-select">
              <option :value="null">-- 默认展示首个活跃镜像源 --</option>
              <option v-for="mirror in mirrors" :key="mirror.id" :value="mirror.id">
                {{ mirror.displayName }}
              </option>
            </select>
          </label>
        </div>
      </Card>
    </main>
  </div>
</template>

<style scoped>
.website-admin__note {
  padding: 12px 14px;
  border-radius: 8px;
  color: var(--text-secondary);
  background: var(--surface-soft);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 8px;
}
.preview-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
}
.form-field-label {
  display: grid;
  gap: 9px;
  margin-top: 20px;
  color: var(--text);
  font-size: 13px;
  font-weight: 650;
}
.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 11px 12px;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  background: var(--surface-soft);
  font: inherit;
  font-weight: 400;
  resize: vertical;
}
.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
}
</style>
