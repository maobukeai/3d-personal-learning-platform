<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ExternalLink, RefreshCw, Search, ShieldCheck, Users } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { fetchTeams, type TeamWorkspaceResponse } from '@/services/workspace.service';

type TeamFilter = 'all' | 'owned' | 'joined';

const router = useRouter();
const authStore = useAuthStore();

const myTeams = ref<TeamWorkspaceResponse[]>([]);
const isLoadingTeams = ref(false);
const searchTerm = ref('');
const activeFilter = ref<TeamFilter>('all');

const fetchMyTeams = async () => {
  isLoadingTeams.value = true;
  try {
    myTeams.value = await fetchTeams();
  } catch {
    ElMessage.error('加载团队空间失败');
  } finally {
    isLoadingTeams.value = false;
  }
};

const ownedTeams = computed(() => myTeams.value.filter((team) => team.ownerId === authStore.user?.id));
const joinedTeams = computed(() => myTeams.value.filter((team) => team.ownerId !== authStore.user?.id));
const totalMembers = computed(() =>
  myTeams.value.reduce((sum, team) => sum + (team._count?.members || 0), 0),
);

const filteredTeams = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  return myTeams.value.filter((team) => {
    const matchesFilter =
      activeFilter.value === 'all' ||
      (activeFilter.value === 'owned' && team.ownerId === authStore.user?.id) ||
      (activeFilter.value === 'joined' && team.ownerId !== authStore.user?.id);
    const matchesSearch = !keyword || team.name.toLowerCase().includes(keyword);
    return matchesFilter && matchesSearch;
  });
});

const filterOptions: Array<{ label: string; value: TeamFilter }> = [
  { label: '全部空间', value: 'all' },
  { label: '我创建的', value: 'owned' },
  { label: '我加入的', value: 'joined' },
];

onMounted(fetchMyTeams);
</script>

<template>
  <div class="teams-section">
    <section class="teams-overview">
      <div>
        <p class="section-kicker">团队空间</p>
        <h3>{{ myTeams.length }} 个空间 · {{ totalMembers }} 名成员</h3>
        <span>快速查看你创建或加入的协作空间，进入任务、项目和成员管理。</span>
      </div>
      <div class="overview-actions">
        <button type="button" class="secondary-action" @click="router.push('/explore-teams')">
          探索团队
          <ExternalLink />
        </button>
        <button type="button" class="primary-action" :disabled="isLoadingTeams" @click="fetchMyTeams">
          <RefreshCw :class="{ spinning: isLoadingTeams }" />
          刷新
        </button>
      </div>
    </section>

    <section class="team-metrics">
      <article>
        <span>我创建的</span>
        <strong>{{ ownedTeams.length }}</strong>
      </article>
      <article>
        <span>我加入的</span>
        <strong>{{ joinedTeams.length }}</strong>
      </article>
      <article>
        <span>平均成员</span>
        <strong>{{ myTeams.length ? Math.round(totalMembers / myTeams.length) : 0 }}</strong>
      </article>
    </section>

    <section class="team-workbench">
      <div class="team-toolbar">
        <label class="team-search">
          <Search />
          <input v-model="searchTerm" type="search" placeholder="搜索团队空间" />
        </label>
        <div class="filter-tabs">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            :class="{ active: activeFilter === option.value }"
            @click="activeFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div v-if="isLoadingTeams" class="team-skeletons">
        <i v-for="item in 4" :key="item"></i>
      </div>

      <div v-else-if="filteredTeams.length > 0" class="team-list">
        <article v-for="team in filteredTeams" :key="team.id" class="team-row">
          <div class="team-avatar">
            <img v-if="team.avatarUrl" :src="team.avatarUrl" :alt="team.name" />
            <span v-else>{{ team.name.charAt(0) }}</span>
          </div>
          <div class="team-copy">
            <div>
              <strong>{{ team.name }}</strong>
              <em v-if="team.ownerId === authStore.user?.id">创建者</em>
              <em v-else>成员</em>
            </div>
            <span>{{ team._count?.members || 0 }} 名成员 · {{ team.type === 'PERSONAL' ? '个人空间' : '团队空间' }}</span>
          </div>
          <div class="team-actions">
            <RouterLink :to="`/team/${team.id}`" title="打开团队">
              <ExternalLink />
            </RouterLink>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <Users />
        <strong>没有匹配的团队空间</strong>
        <span>调整筛选条件，或前往探索团队加入新的协作空间。</span>
      </div>
    </section>

    <section class="quick-grid">
      <button type="button" @click="router.push('/projects')">
        <ShieldCheck />
        <span>
          <strong>团队任务</strong>
          <small>查看任务分配、优先级和进度</small>
        </span>
      </button>
      <button type="button" @click="router.push('/projects')">
        <ExternalLink />
        <span>
          <strong>项目协作</strong>
          <small>进入项目、看板和成员协同</small>
        </span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.teams-section {
  display: grid;
  gap: 12px;
}

.teams-overview,
.team-metrics article,
.team-workbench,
.quick-grid button {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.teams-overview {
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
}

.section-kicker,
.teams-overview span,
.team-metrics span,
.team-copy span,
.quick-grid small,
.empty-state span {
  color: var(--text-muted);
  font-size: 12px;
}

.section-kicker {
  font-size: 11px;
  font-weight: 900;
}

h3 {
  margin: 2px 0 4px;
  font-size: 20px;
  font-weight: 900;
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-action,
.secondary-action {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 0 12px;
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

.primary-action:disabled {
  cursor: wait;
  opacity: 0.65;
}

button svg,
a svg {
  width: 15px;
  height: 15px;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

.team-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.team-metrics article {
  min-height: 64px;
  display: grid;
  gap: 4px;
  padding: 10px;
}

.team-metrics strong {
  font-size: 22px;
  font-weight: 900;
}

.team-workbench {
  padding: 12px;
}

.team-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.team-search {
  width: min(320px, 38vw);
  height: 38px;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.team-search svg {
  width: 15px;
  height: 15px;
  color: var(--text-muted);
}

.team-search input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.filter-tabs {
  display: flex;
  gap: 6px;
}

.filter-tabs button {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
}

.filter-tabs button.active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-app));
}

.team-skeletons,
.team-list {
  display: grid;
  gap: 8px;
}

.team-skeletons i {
  height: 58px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
  animation: pulse 1.1s ease-in-out infinite;
}

.team-row {
  min-height: 64px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.team-avatar {
  width: 42px;
  height: 42px;
  overflow: hidden;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  background: linear-gradient(135deg, #f97316, #2563eb);
  color: #ffffff;
  font-weight: 900;
}

.team-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.team-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.team-copy div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.team-copy strong,
.team-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-copy strong {
  font-size: 13px;
  font-weight: 900;
}

.team-copy em {
  border-radius: 999px;
  padding: 2px 7px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.team-actions a {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  color: var(--text-secondary);
  text-decoration: none;
}

.team-actions a:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-app));
  color: var(--accent);
}

.empty-state {
  min-height: 160px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: var(--text-muted);
  text-align: center;
}

.empty-state svg {
  width: 32px;
  height: 32px;
}

.empty-state strong {
  color: var(--text-primary);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.quick-grid button {
  min-height: 64px;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.quick-grid button:hover {
  border-color: var(--accent);
}

.quick-grid button > svg {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.quick-grid span {
  display: grid;
  gap: 3px;
}

.quick-grid strong {
  font-size: 13px;
  font-weight: 900;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 860px) {
  .teams-overview,
  .team-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .team-search {
    width: 100%;
  }
}

@media (max-width: 620px) {
  .overview-actions,
  .team-metrics,
  .quick-grid {
    grid-template-columns: 1fr;
  }

  .overview-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .primary-action,
  .secondary-action {
    justify-content: center;
    width: 100%;
  }

  .filter-tabs {
    overflow-x: auto;
  }
}
</style>
