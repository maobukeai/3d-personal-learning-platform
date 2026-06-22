<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Camera,
  CheckCircle2,
  Globe,
  MapPin,
  RotateCcw,
  Save,
  UserRound,
  Sparkles,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import AiImageGeneratorDialog from '@/components/AiImageGeneratorDialog.vue';
import AiBioGeneratorDialog from '@/components/AiBioGeneratorDialog.vue';

const authStore = useAuthStore();

const isSaving = ref(false);
const isUploadingAvatar = ref(false);

const createProfileForm = () => ({
  name: authStore.user?.name || '',
  bio: authStore.user?.bio || '',
  location: authStore.user?.location || '',
  website: authStore.user?.website || '',
});

const profileForm = ref(createProfileForm());
const savedSnapshot = ref(JSON.stringify(profileForm.value));

watch(
  () => authStore.user,
  () => {
    profileForm.value = createProfileForm();
    savedSnapshot.value = JSON.stringify(profileForm.value);
  },
  { immediate: true },
);

const normalizedWebsite = computed(() => {
  const value = profileForm.value.website.trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
});

const isWebsiteValid = computed(() => {
  if (!normalizedWebsite.value) return true;
  try {
    new URL(normalizedWebsite.value);
    return true;
  } catch {
    return false;
  }
});

const completionItems = computed(() => [
  { label: '昵称', done: !!profileForm.value.name.trim() },
  { label: '头像', done: !!authStore.user?.avatarUrl },
  { label: '简介', done: !!profileForm.value.bio.trim() },
  { label: '所在地', done: !!profileForm.value.location.trim() },
  { label: '作品主页', done: !!profileForm.value.website.trim() && isWebsiteValid.value },
]);

const completion = computed(() => {
  const done = completionItems.value.filter((item) => item.done).length;
  return Math.round((done / completionItems.value.length) * 100);
});

const hasChanges = computed(() => JSON.stringify(profileForm.value) !== savedSnapshot.value);

const resetForm = () => {
  profileForm.value = createProfileForm();
  savedSnapshot.value = JSON.stringify(profileForm.value);
};

const handleUpdateProfile = async () => {
  if (!profileForm.value.name.trim()) {
    ElMessage.warning('昵称不能为空');
    return;
  }
  if (!isWebsiteValid.value) {
    ElMessage.warning('请输入有效的作品主页链接');
    return;
  }

  try {
    isSaving.value = true;
    await authStore.updateProfile({
      ...profileForm.value,
      website: normalizedWebsite.value,
    });
    savedSnapshot.value = JSON.stringify({
      ...profileForm.value,
      website: normalizedWebsite.value,
    });
    profileForm.value.website = normalizedWebsite.value;
    ElMessage.success('个人资料已保存');
  } catch {
    ElMessage.error('保存个人资料失败');
  } finally {
    isSaving.value = false;
  }
};

const handleAvatarUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件');
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    ElMessage.warning('头像文件不能超过 4MB');
    return;
  }

  try {
    isUploadingAvatar.value = true;
    await authStore.uploadAvatar(file);
    ElMessage.success('头像已更新');
  } catch {
    ElMessage.error('头像上传失败');
  } finally {
    isUploadingAvatar.value = false;
  }
};

const isUploadingCover = ref(false);

const aiGeneratorShow = ref(false);
const aiGeneratorType = ref<'avatar' | 'cover'>('avatar');
const aiGeneratorTitle = ref('');

const aiBioGeneratorShow = ref(false);

const openAiBioGenerator = () => {
  aiBioGeneratorShow.value = true;
};

const handleAiBioSave = (bio: string) => {
  profileForm.value.bio = bio;
};

const openAiAvatarGenerator = () => {
  aiGeneratorType.value = 'avatar';
  aiGeneratorTitle.value = 'AI 生成头像';
  aiGeneratorShow.value = true;
};

const openAiCoverGenerator = () => {
  aiGeneratorType.value = 'cover';
  aiGeneratorTitle.value = 'AI 生成个人封面';
  aiGeneratorShow.value = true;
};

const handleAiImageSave = async (file: File) => {
  if (aiGeneratorType.value === 'avatar') {
    try {
      isUploadingAvatar.value = true;
      await authStore.uploadAvatar(file);
      ElMessage.success('头像已更新');
    } catch {
      ElMessage.error('头像更新失败');
    } finally {
      isUploadingAvatar.value = false;
    }
  } else {
    try {
      isUploadingCover.value = true;
      await authStore.uploadCover(file);
      ElMessage.success('个人封面已更新');
    } catch {
      ElMessage.error('个人封面更新失败');
    } finally {
      isUploadingCover.value = false;
    }
  }
};

const handleCoverUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件');
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    ElMessage.warning('封面文件不能超过 4MB');
    return;
  }

  try {
    isUploadingCover.value = true;
    await authStore.uploadCover(file);
    ElMessage.success('个人封面已更新');
  } catch {
    ElMessage.error('个人封面上传失败');
  } finally {
    isUploadingCover.value = false;
  }
};
</script>

<template>
  <div class="profile-section">
    <section class="settings-group">
      <header class="group-header">
        <div>
          <p class="section-kicker">公开资料</p>
          <h3>个人资料</h3>
          <span>这些信息会显示在成员资料、作品页和协作空间中。</span>
        </div>
      </header>

      <div class="setting-row avatar-row">
        <div class="row-copy">
          <strong>头像</strong>
          <span>建议上传清晰方形图片，最大 4MB。</span>
        </div>
        <div class="flex items-center gap-3">
          <label class="avatar-control">
            <UserAvatar :user="authStore.user" size="lg" />
            <span class="avatar-button">
              <Camera />
              {{ isUploadingAvatar ? '上传中' : '更换头像' }}
            </span>
            <input
              type="file"
              accept="image/*"
              :disabled="isUploadingAvatar"
              @change="handleAvatarUpload"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            class="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent font-bold border border-accent/20 cursor-pointer h-[36px] text-xs px-3 rounded-lg"
            :disabled="isUploadingAvatar"
            @click="openAiAvatarGenerator"
          >
            <Sparkles class="w-3.5 h-3.5" />
            AI 生成
          </Button>
        </div>
      </div>

      <div class="setting-row cover-row">
        <div class="row-copy">
          <strong>个人封面</strong>
          <span>用于个人主页和弹窗背景，建议比例 21:9，最大 4MB。</span>
        </div>
        <div class="flex items-center gap-4 flex-wrap">
          <div
            class="w-40 h-16 rounded-lg overflow-hidden border border-[var(--border-strong)] bg-slate-900/60 relative"
          >
            <img
              v-if="authStore.user?.coverUrl"
              :src="authStore.user.coverUrl"
              class="w-full h-full object-cover object-[center_35%]"
              alt="User Cover"
            />
            <div
              v-else
              class="w-full h-full bg-gradient-to-r from-violet-600 to-rose-500 opacity-80"
            ></div>
          </div>
          <div class="flex items-center gap-2">
            <label class="avatar-control relative">
              <span class="avatar-button">
                <Camera />
                {{ isUploadingCover ? '上传中' : '更换封面' }}
              </span>
              <input
                type="file"
                accept="image/*"
                :disabled="isUploadingCover"
                @change="handleCoverUpload"
                class="hidden"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              class="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent font-bold border border-accent/20 cursor-pointer h-[36px] text-xs px-3 rounded-lg"
              :disabled="isUploadingCover"
              @click="openAiCoverGenerator"
            >
              <Sparkles class="w-3.5 h-3.5" />
              AI 生成
            </Button>
          </div>
        </div>
      </div>

      <div class="setting-row">
        <label class="row-copy" for="profile-name">
          <strong>昵称</strong>
          <span>用于个人主页、评论和团队成员列表。</span>
        </label>
        <Input
          id="profile-name"
          v-model="profileForm.name"
          type="text"
          maxlength="50"
          placeholder="你的展示名称"
          :icon="UserRound"
        />
      </div>

      <div class="setting-row">
        <label class="row-copy" for="profile-location">
          <strong>所在地</strong>
          <span>可选，用于让协作者了解你的时区或城市。</span>
        </label>
        <Input
          id="profile-location"
          v-model="profileForm.location"
          type="text"
          maxlength="100"
          placeholder="城市，国家"
          :icon="MapPin"
        />
      </div>

      <div class="setting-row text-row">
        <label class="row-copy" for="profile-bio">
          <div class="flex items-center justify-between w-full pr-4">
            <strong>个人简介</strong>
            <Button
              type="button"
              variant="secondary"
              class="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent font-bold border border-accent/20 cursor-pointer h-[28px] text-[11px] px-2 rounded-md"
              @click.stop.prevent="openAiBioGenerator"
            >
              <Sparkles class="w-3 h-3" />
              AI 生成
            </Button>
          </div>
          <span>一句话说明你的方向、技能或正在学习的内容。</span>
        </label>
        <div class="field-stack">
          <textarea
            id="profile-bio"
            v-model="profileForm.bio"
            maxlength="500"
            rows="4"
            placeholder="向大家介绍一下你自己、擅长方向或正在学习的内容..."
          ></textarea>
          <small>{{ profileForm.bio.length }}/500</small>
        </div>
      </div>

      <div class="setting-row">
        <label class="row-copy" for="profile-website">
          <strong>个人主页 / 作品集</strong>
          <span>支持自动补全 https://，保存前会校验格式。</span>
        </label>
        <Input
          id="profile-website"
          v-model="profileForm.website"
          type="url"
          maxlength="255"
          placeholder="https://yourportfolio.com"
          :icon="Globe"
          :error="!isWebsiteValid ? '链接格式不正确' : ''"
        />
      </div>
    </section>

    <section class="settings-group checklist-group">
      <header class="group-header compact">
        <div>
          <p class="section-kicker">资料状态</p>
          <h3>完善清单</h3>
        </div>
        <div class="progress-track" :aria-label="`资料完成度 ${completion}%`">
          <i :style="{ width: `${completion}%` }"></i>
        </div>
      </header>

      <div class="check-grid">
        <div
          v-for="item in completionItems"
          :key="item.label"
          class="check-item"
          :class="{ done: item.done }"
        >
          <CheckCircle2 />
          <span>{{ item.label }}</span>
        </div>
      </div>
    </section>

    <footer class="settings-actions">
      <Button
        variant="secondary"
        :disabled="!hasChanges || isSaving"
        :icon="RotateCcw"
        @click="resetForm"
      >
        重置
      </Button>
      <Button
        variant="primary"
        :disabled="!hasChanges || isSaving"
        :loading="isSaving"
        :icon="Save"
        @click="handleUpdateProfile"
      >
        保存资料
      </Button>
    </footer>

    <!-- AI Image Generation Dialog -->
    <AiImageGeneratorDialog
      :show="aiGeneratorShow"
      :title="aiGeneratorTitle"
      :type="aiGeneratorType"
      @close="aiGeneratorShow = false"
      @save="handleAiImageSave"
    />

    <!-- AI Bio Generation Dialog -->
    <AiBioGeneratorDialog
      :show="aiBioGeneratorShow"
      @close="aiBioGeneratorShow = false"
      @save="handleAiBioSave"
    />
  </div>
</template>

<style scoped>
.profile-section {
  display: grid;
  gap: 14px;
}

.settings-group,
.settings-actions {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.settings-group {
  overflow: hidden;
}

.group-header {
  min-height: 74px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-base);
}

.group-header.compact {
  min-height: 64px;
}

h3,
p {
  margin: 0;
}

h3 {
  margin-top: 2px;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 900;
}

.section-kicker,
.group-header span,
.row-copy span,
.field-stack small {
  color: var(--text-muted);
  font-size: 12px;
}

.section-kicker {
  font-size: 11px;
  font-weight: 900;
}

.completion-badge {
  min-width: 84px;
  display: grid;
  gap: 3px;
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--bg-app);
  text-align: right;
}

.completion-badge span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.completion-badge strong {
  font-size: 20px;
  font-weight: 900;
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.32fr) minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-base);
}

.setting-row:last-child {
  border-bottom: 0;
}

.text-row {
  align-items: start;
}

.row-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.row-copy strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.avatar-row {
  align-items: center;
}

.avatar-control {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 12px;
  cursor: pointer;
}

.avatar-control input {
  display: none;
}

.avatar-button {
  height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.avatar-control:hover .avatar-button {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border-base));
}

.input-shell {
  min-height: 42px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.field-stack {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.input-shell.invalid {
  border-color: #ef4444;
}

.input-shell svg {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

input,
textarea {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

textarea {
  min-height: 96px;
  padding: 11px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  resize: vertical;
  background: var(--bg-app);
}

.error-text {
  color: #dc2626;
}

.checklist-group {
  background: color-mix(in srgb, var(--bg-card) 92%, var(--bg-app));
}

.progress-track {
  width: min(280px, 36vw);
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 12%, transparent);
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #10b981);
}

.check-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 14px 16px;
}

.check-item {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.check-item.done {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.2);
  color: #10b981;
  font-weight: 600;
}

.check-item svg,
.avatar-button svg {
  width: 15px;
  height: 15px;
}

.settings-actions {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
}

.primary-action,
.secondary-action {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 0 14px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
}

.primary-action {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.secondary-action {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
}

.primary-action:disabled,
.secondary-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-action svg,
.secondary-action svg {
  width: 15px;
  height: 15px;
}

@media (max-width: 960px) {
  .setting-row {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .check-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .group-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .completion-badge {
    width: 100%;
    text-align: left;
  }

  .progress-track {
    width: 100%;
  }

  .check-grid {
    grid-template-columns: 1fr;
  }

  .settings-actions {
    flex-direction: column;
  }

  .primary-action,
  .secondary-action {
    justify-content: center;
    width: 100%;
  }
}
</style>
