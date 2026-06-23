<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  ChevronDown,
  Plus,
  Settings,
  User as UserIcon,
  GraduationCap,
  Box,
  Briefcase,
  Lock,
} from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspace';
import type { Workspace } from '@/stores/workspace';
import { getAssetUrl } from '@/utils/api';
import GlassDropdown from '@/components/ui/GlassDropdown.vue';

const router = useRouter();
const workspaceStore = useWorkspaceStore();

const normalWorkspaces = computed(() => {
  return workspaceStore.workspaces.filter((ws) => ws.type !== 'admin');
});

const adminWorkspace = computed(() => {
  return workspaceStore.workspaces.find((ws) => ws.type === 'admin');
});

const handleSwitchWorkspace = (ws: Workspace, event?: Event) => {
  if (event) {
    const target = event.target as HTMLElement;
    if (
      target.closest('button')?.querySelector('.lucide-settings') ||
      target.closest('.lucide-settings')
    ) {
      return;
    }
  }
  workspaceStore.setWorkspace(ws);
  if (ws.type === 'admin') {
    router.push('/admin/dashboard');
  } else if (ws.type === 'mirror') {
    if (ws.mirrorSourceId) {
      router.push(`/mirror/source/${ws.mirrorSourceId}`);
    } else {
      router.push('/mirror');
    }
  } else if (ws.type === 'manual') {
    if (ws.manualStationId) {
      router.push(`/manual/station/${ws.manualStationId}`);
    } else {
      router.push('/academy');
    }
  } else {
    router.push('/dashboard');
  }
};

const handleQuickSettings = (ws: Workspace) => {
  if (ws.type === 'admin') {
    router.push('/admin/settings');
  } else if (ws.type === 'mirror') {
    router.push({ path: '/admin/mirror', query: { sourceId: ws.mirrorSourceId } });
  } else if (ws.type === 'manual') {
    router.push({ path: '/admin/manual', query: { stationId: ws.manualStationId } });
  } else if (ws.type === 'personal') {
    router.push({ path: '/settings', query: { tab: 'profile' } });
  } else {
    router.push({ path: `/team/${ws.id}`, query: { tab: 'settings' } });
  }
};
</script>

<template>
  <div v-if="!workspaceStore.isInitialized" class="flex items-center gap-2.5 animate-pulse">
    <div class="w-7 h-7 rounded bg-slate-200/50 dark:bg-white/10"></div>
  </div>
  <GlassDropdown
    v-else-if="workspaceStore.currentWorkspace"
    trigger="click"
    placement="bottom-start"
    popper-class="workspace-switcher-popper"
    menu-class="w-72 max-w-[calc(100vw-16px)] p-2"
  >
    <template #trigger>
      <div
        class="workspace-switcher-badge min-h-8 h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 flex items-center gap-2 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-white/8 transition-colors animate-in fade-in duration-300 min-w-0"
      >
        <div class="relative shrink-0">
          <img
            v-if="workspaceStore.currentWorkspace?.avatarUrl"
            alt=""
            :src="getAssetUrl(workspaceStore.currentWorkspace.avatarUrl)"
            class="w-5.5 h-5.5 rounded object-cover border border-slate-200/50 dark:border-white/10"
          />
          <div
            v-else
            class="w-5.5 h-5.5 rounded-full text-white flex items-center justify-center font-bold text-[10px] shrink-0"
            :class="
              workspaceStore.currentWorkspace.type === 'personal'
                ? 'bg-slate-900 border border-white/5'
                : workspaceStore.currentWorkspace.color
            "
          >
            <svg
              v-if="workspaceStore.currentWorkspace.type === 'personal'"
              class="w-4.5 h-4.5"
              viewBox="0 0 128 128"
              fill="none"
            >
              <path
                d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0"
                fill="#235785"
              />
              <path
                d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.313 22.313 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0"
                fill="#F5792A"
              />
            </svg>
            <span v-else>{{ workspaceStore.currentWorkspace.name.charAt(0) }}</span>
          </div>
        </div>
        <span
          class="text-xs font-bold text-slate-600 dark:text-slate-200 truncate max-w-[180px] hidden md:block"
        >
          {{ workspaceStore.currentWorkspace.name }}
        </span>
        <ChevronDown class="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </div>
    </template>

    <div class="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
      {{ $t('layout.switchWorkspace') }}
    </div>

    <!-- Normal workspaces loop -->
    <el-dropdown-item
      v-for="ws in normalWorkspaces"
      :key="ws.id"
      class="rounded-lg my-1 p-2 group transition-all duration-200 relative overflow-hidden pl-3"
      :class="workspaceStore.activeWorkspaceId === ws.id ? 'bg-accent/5' : ''"
      @click="handleSwitchWorkspace(ws, $event)"
    >
      <!-- Active vertical indicator pill on the left of item -->
      <div
        v-if="workspaceStore.activeWorkspaceId === ws.id"
        class="absolute left-0 top-1 bottom-1 w-[3px] bg-accent rounded-r"
      ></div>

      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-3">
          <div class="relative shrink-0">
            <img
              v-if="ws.avatarUrl && ws.type !== 'personal'"
              alt=""
              :src="getAssetUrl(ws.avatarUrl)"
              class="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200/50 dark:border-white/10"
            />
            <!-- Custom styled icons per type -->
            <div
              v-else-if="ws.type === 'personal'"
              class="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-900 shrink-0 border border-white/5 shadow-inner"
            >
              <svg class="w-6 h-6" viewBox="0 0 128 128" fill="none">
                <path
                  d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0"
                  fill="#235785"
                />
                <path
                  d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.313 22.313 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0"
                  fill="#F5792A"
                />
              </svg>
            </div>
            <div
              v-else-if="ws.type === 'mirror'"
              class="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EAB308] shrink-0 border border-yellow-400/20 shadow-inner"
            >
              <GraduationCap class="w-4.5 h-4.5 text-white" />
            </div>
            <div
              v-else-if="ws.type === 'manual'"
              class="w-8 h-8 rounded-lg flex items-center justify-center bg-[#3B82F6] shrink-0 border border-blue-400/20 shadow-inner"
            >
              <Box class="w-4.5 h-4.5 text-white" />
            </div>
            <div
              v-else-if="ws.type === 'team'"
              class="w-8 h-8 rounded-lg flex items-center justify-center bg-[#A855F7] shrink-0 border border-purple-400/20 shadow-inner"
            >
              <Briefcase class="w-4.5 h-4.5 text-white" />
            </div>
            <div
              v-if="ws.badgeCount"
              class="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-slate-900 px-1"
            >
              {{ ws.badgeCount > 99 ? '99+' : ws.badgeCount }}
            </div>
          </div>
          <div class="flex flex-col text-left">
            <span
              class="font-semibold text-xs"
              :class="
                workspaceStore.activeWorkspaceId === ws.id
                  ? 'text-accent'
                  : 'text-slate-700 dark:text-slate-200'
              "
            >
              {{ ws.name }}
            </span>
            <span class="text-[9px] text-slate-500 font-medium">
              {{ ws.description }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="ws.type === 'personal' || ws.type === 'team'"
            type="button"
            class="p-1.5 rounded-md hover:bg-white/8 text-slate-400 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
            @click.stop="handleQuickSettings(ws)"
          >
            <Settings class="w-3.5 h-3.5" />
          </button>
          <div
            v-if="workspaceStore.activeWorkspaceId === ws.id"
            class="w-1 h-1 rounded-full bg-accent"
          ></div>
        </div>
      </div>
    </el-dropdown-item>

    <!-- Divider and Admin Workspace (if exists) -->
    <template v-if="adminWorkspace">
      <div class="border-t border-slate-100 dark:border-white/6 my-2"></div>

      <el-dropdown-item
        :key="adminWorkspace.id"
        class="rounded-lg my-1 p-2 group transition-all duration-200 relative overflow-hidden pl-3"
        :class="workspaceStore.activeWorkspaceId === adminWorkspace.id ? 'bg-accent/5' : ''"
        @click="handleSwitchWorkspace(adminWorkspace, $event)"
      >
        <!-- Active vertical indicator pill for admin -->
        <div
          v-if="workspaceStore.activeWorkspaceId === adminWorkspace.id"
          class="absolute left-0 top-1 bottom-1 w-[3px] bg-accent rounded-r"
        ></div>

        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-3">
            <div class="relative shrink-0">
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center bg-[#10B981] shrink-0 border border-emerald-400/20 shadow-inner"
              >
                <UserIcon class="w-4.5 h-4.5 text-white" />
              </div>
              <div
                v-if="adminWorkspace.badgeCount"
                class="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-slate-900 px-1"
              >
                {{ adminWorkspace.badgeCount > 99 ? '99+' : adminWorkspace.badgeCount }}
              </div>
            </div>
            <div class="flex flex-col text-left">
              <span
                class="font-semibold text-xs"
                :class="
                  workspaceStore.activeWorkspaceId === adminWorkspace.id
                    ? 'text-accent'
                    : 'text-slate-700 dark:text-slate-200'
                "
              >
                {{ $t('layout.adminWorkspace') }}
              </span>
              <span class="text-[9px] text-slate-500 font-medium">
                {{ adminWorkspace.description }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Lock class="w-3.5 h-3.5 text-slate-500" />
            <div
              v-if="workspaceStore.activeWorkspaceId === adminWorkspace.id"
              class="w-1 h-1 rounded-full bg-accent"
            ></div>
          </div>
        </div>
      </el-dropdown-item>
    </template>

    <div class="border-t border-slate-100 dark:border-white/6 my-2"></div>
    <el-dropdown-item class="rounded-lg my-0.5" @click="router.push('/explore-teams')">
      <div class="flex items-center gap-3 py-1 text-slate-500">
        <Plus class="w-4 h-4" />
        <span class="font-medium">{{ $t('layout.createOrJoinTeam') }}</span>
      </div>
    </el-dropdown-item>
  </GlassDropdown>
</template>
