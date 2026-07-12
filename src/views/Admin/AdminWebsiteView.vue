<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Save, ExternalLink } from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import Button from '@/components/ui/Button.vue';
import AdminHeader from './components/AdminHeader.vue';

const loading = ref(false);
const saving = ref(false);
const form = ref({
  eyebrow: 'PERSONAL LEARNING PLATFORM',
  title: '把每一次学习，\n变成看得见的成长。',
  subtitle: '一个将课程、资源、3D 创作与协作串联起来的个人学习空间。更专注，也更自由。',
});

const load = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/api/admin/website/home');
    form.value = { ...form.value, ...data };
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
  <div class="website-admin">
    <AdminHeader
      title="官网运营"
      description="管理主域名官网的首页文案；资源和镜像数据仍由各自模块统一维护。"
    >
      <template #actions>
        <a class="preview-link" href="/" target="_blank" rel="noopener"
          >预览官网 <ExternalLink :size="14"
        /></a>
        <Button :loading="saving" @click="save"><Save :size="15" /> 保存发布</Button>
      </template>
    </AdminHeader>

    <section class="website-admin__content" :aria-busy="loading">
      <div class="website-admin__note">
        首页采用简约玻璃视觉。此处修改会在官网下一次请求时生效。
      </div>
      <label>眉题 <input v-model="form.eyebrow" maxlength="80" /></label>
      <label>主标题 <textarea v-model="form.title" rows="3" maxlength="160" /></label>
      <label>介绍文案 <textarea v-model="form.subtitle" rows="4" maxlength="300" /></label>
    </section>
  </div>
</template>

<style scoped>
.website-admin {
  height: 100%;
  min-width: 0;
}
.website-admin__content {
  width: min(720px, 100%);
  padding: 28px;
  margin: 22px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
}
.website-admin__content label {
  display: grid;
  gap: 9px;
  margin-top: 22px;
  color: var(--text);
  font-size: 13px;
  font-weight: 650;
}
.website-admin__content input,
.website-admin__content textarea {
  width: 100%;
  padding: 11px 12px;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  outline: none;
  background: var(--surface-soft);
  font: inherit;
  font-weight: 400;
  resize: vertical;
}
.website-admin__content input:focus,
.website-admin__content textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
}
.website-admin__note {
  padding: 12px 14px;
  border-radius: 10px;
  color: var(--text-secondary);
  background: var(--surface-soft);
  font-size: 13px;
  line-height: 1.6;
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
</style>
