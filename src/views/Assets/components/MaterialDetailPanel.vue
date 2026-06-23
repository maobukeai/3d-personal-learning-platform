<script setup lang="ts">
import {
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  FileArchive,
  Heart,
  Loader2,
  Trash2,
  X,
  XCircle,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { formatCompactNumber, formatDate, formatFileSize } from '../resourceUtils';
import { useLabel } from '@/utils/i18n';

type MaterialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusTone = 'success' | 'warning' | 'danger';

interface NormalizedMaterial {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  preview: string;
  downloads: number;
  fileSize: number;
  resolution: string;
  favorites: number;
  isProcedural?: boolean;
  status?: MaterialStatus;
  rejectReason?: string | null;
  userId?: string;
  isFavorited?: boolean;
  _count?: { favorites?: number };
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  createdAt?: string;
}

defineProps<{
  material: NormalizedMaterial;
  loading: boolean;
  myMaterials: NormalizedMaterial[];
  isAdmin: boolean;
  canEdit: boolean;
  canDownload: boolean;
  isSavingReview?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'favorite'): void;
  (e: 'download'): void;
  (e: 'edit', item: NormalizedMaterial): void;
  (e: 'select', item: NormalizedMaterial): void;
  (e: 'delete'): void;
  (e: 'review-approved'): void;
  (e: 'review-rejected'): void;
}>();

const label = useLabel();

const getStatusMeta = (status?: string) => {
  const statusMap: Record<string, { label: string; tone: StatusTone; icon: typeof CheckCircle2 }> =
    {
      APPROVED: { label: label('已通过', 'Approved'), tone: 'success', icon: CheckCircle2 },
      PENDING: { label: label('待审核', 'Pending'), tone: 'warning', icon: Clock3 },
      REJECTED: { label: label('已驳回', 'Rejected'), tone: 'danger', icon: XCircle },
    };
  return statusMap[(status || 'APPROVED') as MaterialStatus] || statusMap.APPROVED;
};
</script>

<template>
  <aside class="detail-drawer">
    <button type="button" class="close-button" @click="emit('close')">
      <X class="icon-sm" />
    </button>

    <div v-if="loading" class="drawer-loading">
      <Loader2 class="spinning" />
    </div>

    <template v-else>
      <div class="drawer-preview">
        <img :src="material.preview" :alt="material.title" />
        <div class="drawer-badges">
          <span>{{ material.category }}</span>
          <span>{{ material.resolution }}</span>
          <span v-if="material.isProcedural">{{ label('程序化', 'Procedural') }}</span>
        </div>
      </div>

      <div class="drawer-body">
        <div class="drawer-title">
          <h2>{{ material.title }}</h2>
          <span class="status-pill" :data-tone="getStatusMeta(material.status).tone">
            <component :is="getStatusMeta(material.status).icon" class="icon-xs" />
            {{ getStatusMeta(material.status).label }}
          </span>
        </div>
        <p>
          {{
            material.description || label('作者暂未填写材料说明。', 'No material description yet.')
          }}
        </p>

        <dl class="detail-grid">
          <div>
            <dt>{{ label('体积', 'Size') }}</dt>
            <dd>{{ formatFileSize(material.fileSize) }}</dd>
          </div>
          <div>
            <dt>{{ label('下载', 'Downloads') }}</dt>
            <dd>{{ formatCompactNumber(material.downloads) }}</dd>
          </div>
          <div>
            <dt>{{ label('收藏', 'Favorites') }}</dt>
            <dd>{{ formatCompactNumber(material.favorites) }}</dd>
          </div>
          <div>
            <dt>{{ label('上传', 'Uploaded') }}</dt>
            <dd>{{ formatDate(material.createdAt) }}</dd>
          </div>
        </dl>

        <div v-if="material.rejectReason" class="reject-note">
          <strong>{{ label('驳回原因', 'Rejection Reason') }}</strong>
          <span>{{ material.rejectReason }}</span>
        </div>

        <div class="tag-row detail-tags">
          <span v-for="tag in material.tags" :key="tag">#{{ tag }}</span>
        </div>

        <div v-if="material.user" class="author-row">
          <UserAvatar :user="material.user" size="sm" />
          <div>
            <strong>{{
              material.user.name || material.user.email || label('创作者', 'Creator')
            }}</strong>
            <span>{{ label('材料贡献者', 'Material Contributor') }}</span>
          </div>
        </div>

        <div v-if="myMaterials.length" class="my-submissions">
          <header>
            <FileArchive class="icon-sm" />
            <span>{{ label('我的最近提交', 'My Recent Uploads') }}</span>
          </header>
          <button
            v-for="item in myMaterials"
            :key="item.id"
            type="button"
            class="submission-item"
            @click="emit('select', item)"
          >
            <span>{{ item.title }}</span>
            <small :data-tone="getStatusMeta(item.status).tone">{{
              getStatusMeta(item.status).label
            }}</small>
          </button>
        </div>
      </div>

      <footer class="drawer-actions">
        <button
          type="button"
          class="ghost-button icon-text"
          :class="{ active: material.isFavorited }"
          @click="emit('favorite')"
        >
          <Heart class="icon-sm" :class="{ filled: material.isFavorited }" />
          {{ material.isFavorited ? label('已收藏', 'Favorited') : label('收藏', 'Favorite') }}
        </button>
        <button
          type="button"
          class="primary-button icon-text"
          :disabled="!canDownload"
          @click="emit('download')"
        >
          <Download class="icon-sm" />
          {{ label('下载', 'Download') }}
        </button>
        <button
          v-if="canEdit"
          type="button"
          class="ghost-button square-action"
          @click="emit('edit', material)"
        >
          <Edit3 class="icon-sm" />
        </button>
        <button
          v-if="canEdit"
          type="button"
          class="danger-button square-action"
          @click="emit('delete')"
        >
          <Trash2 class="icon-sm" />
        </button>
      </footer>

      <div v-if="isAdmin && material.status === 'PENDING'" class="review-actions">
        <button
          type="button"
          class="approve-button"
          :disabled="isSavingReview"
          @click="emit('review-approved')"
        >
          <CheckCircle2 class="icon-sm" />
          {{ label('通过', 'Approve') }}
        </button>
        <button
          type="button"
          class="reject-button"
          :disabled="isSavingReview"
          @click="emit('review-rejected')"
        >
          <XCircle class="icon-sm" />
          {{ label('驳回', 'Reject') }}
        </button>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.detail-drawer {
  position: sticky;
  top: 10px;
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.close-button {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: #fff;
  border-color: var(--border-strong);
}

.drawer-loading {
  display: grid;
  place-items: center;
  min-height: 380px;
  color: #d97706;
}

.drawer-preview {
  position: relative;
  height: 180px;
  overflow: hidden;
  background: #172033;
}

.drawer-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.drawer-badges {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.drawer-badges span {
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  padding: 2px 5px;
  font-size: 9px;
  font-weight: 600;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.drawer-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.drawer-title h2 {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
}

.drawer-body > p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
}

.detail-grid div,
.reject-note,
.author-row,
.my-submissions {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-hover);
}

.detail-grid div {
  padding: 6px;
}

.detail-grid dt {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
}

.detail-grid dd {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reject-note {
  display: grid;
  gap: 3px;
  padding: 8px;
}

.reject-note strong {
  color: #dc2626;
  font-size: 10px;
}

.reject-note span {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 0;
}

.detail-tags span {
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 500;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.author-row strong,
.author-row span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-row strong {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.author-row span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
}

.my-submissions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
}

.my-submissions header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.submission-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 28px;
  padding: 0 4px;
  font-size: 11px;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.my-submissions > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.submission-item:hover {
  background: var(--bg-hover);
}

.submission-item span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submission-item small {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 600;
}

.drawer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-top: 1px solid var(--border-base);
  padding: 10px 12px;
}

.review-actions {
  display: flex;
  gap: 6px;
  border-top: 1px solid var(--border-base);
  padding: 0 12px 12px;
}

.primary-button,
.ghost-button,
.danger-button,
.approve-button,
.reject-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-base);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-text {
  gap: 6px;
}

.primary-button {
  border-color: transparent;
  background: #d97706;
  color: #fff;
  box-shadow: 0 2px 4px rgba(217, 119, 6, 0.15);
}

.primary-button:hover {
  background: #c26702;
  transform: translateY(-0.5px);
}

.ghost-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.ghost-button.active {
  border-color: rgba(225, 29, 72, 0.25);
  background: rgba(225, 29, 72, 0.05);
  color: #e11d48;
}

.danger-button {
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}

.danger-button:hover {
  background: rgba(220, 38, 38, 0.1);
  border-color: #dc2626;
}

.approve-button {
  border-color: rgba(5, 150, 105, 0.25);
  background: rgba(5, 150, 105, 0.05);
  color: #047857;
}

.approve-button:hover {
  background: rgba(5, 150, 105, 0.1);
  border-color: #059669;
}

.reject-button {
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}

.reject-button:hover {
  background: rgba(220, 38, 38, 0.1);
  border-color: #dc2626;
}

.square-action {
  display: grid;
  place-items: center;
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-xs {
  width: 11px;
  height: 11px;
}

.filled {
  fill: #e11d48;
}

.status-pill {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
}

.status-pill[data-tone='success'],
.submission-item small[data-tone='success'] {
  background: rgba(5, 150, 105, 0.1);
  color: #047857;
}

.status-pill[data-tone='warning'],
.submission-item small[data-tone='warning'] {
  background: rgba(217, 119, 6, 0.1);
  color: #b45309;
}

.status-pill[data-tone='danger'],
.submission-item small[data-tone='danger'] {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1080px) {
  .detail-drawer {
    position: relative;
    top: 0;
  }
}

@media (max-width: 860px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
