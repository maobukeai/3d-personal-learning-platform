<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  LayoutDashboard, Box, FolderOpen, Layers, MapPin, Wind, Image as ImageIcon,
  Users, Clock, FileText, MonitorPlay, MessageSquare, Briefcase, GraduationCap,
  Settings, HelpCircle, Gem, ChevronDown
} from 'lucide-vue-next'

const route = useRoute()

const currentWorkspace = ref({ id: 1, name: 'Personal Space', type: 'personal', color: 'bg-blue-600' })

const workspaces = [
  { id: 1, name: 'Personal Space', type: 'personal', color: 'bg-blue-600' },
  { id: 2, name: 'Team Alpha', type: 'team', color: 'bg-orange-500' },
  { id: 3, name: '3D Design Club', type: 'team', color: 'bg-purple-500' },
]

const handleSwitchWorkspace = (ws: any) => {
  currentWorkspace.value = ws
}

const menuGroups = [
  {
    title: '我的学习',
    items: [
      { name: '仪表盘', icon: LayoutDashboard, path: '/dashboard' },
      { name: '工作与计划', icon: Briefcase, path: '/work' },
      { name: '学习路线', icon: MapPin, path: '/roadmaps' },
      { name: '学院', icon: GraduationCap, path: '/academy' },
    ]
  },
  {
    title: '团队协作',
    items: [
      { name: '团队任务', icon: Users, path: '/team-tasks' },
      { name: '成员', icon: Users, path: '/members' },
    ]
  },
  {
    title: '资源中心',
    items: [
      { name: '我的作品', icon: Box, path: '/my-works' },
      { name: '3D 资产库', icon: ImageIcon, path: '/assets' },
      { name: '项目', icon: FolderOpen, path: '/projects' },
      { name: '材料', icon: Layers, path: '/materials' },
    ]
  },
  {
    title: '交流社区',
    items: [
      { name: '讨论区', icon: MessageSquare, path: '/discussions' },
      { name: '消息', icon: MessageSquare, path: '/messages' },
      { name: '作品展示', icon: MonitorPlay, path: '/showcase' },
    ]
  }
]
</script>

<template>
  <div class="flex h-screen w-full bg-white overflow-hidden text-sm">
    <!-- Global Sidebar -->
    <aside class="w-60 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0">
      
      <!-- Workspace Switcher -->
      <div class="p-4 border-b border-slate-200">
        <el-dropdown trigger="click" class="w-full" placement="bottom-start">
          <div class="flex items-center justify-between w-full p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm" :class="currentWorkspace.color">
                {{ currentWorkspace.name.charAt(0) }}
              </div>
              <span class="font-bold text-slate-800 truncate">{{ currentWorkspace.name }}</span>
            </div>
            <ChevronDown class="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <template #dropdown>
            <div class="w-64 p-2">
              <div class="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">个人空间</div>
              <el-dropdown-item v-for="ws in workspaces.filter(w => w.type === 'personal')" :key="ws.id" @click="handleSwitchWorkspace(ws)" class="rounded-lg">
                <div class="flex items-center gap-3 w-full py-0.5">
                  <div class="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">{{ ws.name.charAt(0) }}</div>
                  <span class="flex-1 font-medium" :class="currentWorkspace.id === ws.id ? 'text-blue-600' : 'text-slate-700'">{{ ws.name }}</span>
                  <div v-if="currentWorkspace.id === ws.id" class="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                </div>
              </el-dropdown-item>

              <div class="h-px bg-slate-100 my-2"></div>
              
              <div class="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">加入的团队</div>
              <el-dropdown-item v-for="ws in workspaces.filter(w => w.type === 'team')" :key="ws.id" @click="handleSwitchWorkspace(ws)" class="rounded-lg">
                <div class="flex items-center gap-3 w-full py-0.5">
                  <div class="w-6 h-6 rounded text-white flex items-center justify-center text-[10px] font-bold" :class="ws.color">{{ ws.name.charAt(0) }}</div>
                  <span class="flex-1 font-medium" :class="currentWorkspace.id === ws.id ? 'text-blue-600' : 'text-slate-700'">{{ ws.name }}</span>
                  <div v-if="currentWorkspace.id === ws.id" class="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                </div>
              </el-dropdown-item>

              <div class="h-px bg-slate-100 my-2"></div>

              <div class="space-y-1">
                <button class="w-full text-left px-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg flex items-center gap-2 transition-colors">
                  <Plus class="w-3.5 h-3.5" /> 创建新团队
                </button>
                <button class="w-full text-left px-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg flex items-center gap-2 transition-colors">
                  <Users class="w-3.5 h-3.5" /> 探索更多学习小组
                </button>
              </div>
            </div>
          </template>
        </el-dropdown>
      </div>

      <div class="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-hide">
        <div v-for="(group, index) in menuGroups" :key="index">
          <h3 v-if="group.title" class="px-3 mb-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
            {{ group.title }}
          </h3>
          <ul class="space-y-1">
            <li v-for="item in group.items" :key="item.name">
              <RouterLink :to="item.path"
                class="flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150"
                :class="route.path === item.path ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'">
                <component :is="item.icon" class="w-4 h-4" :class="route.path === item.path ? 'text-blue-600' : 'text-slate-400'" />
                {{ item.name }}
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>

      <div class="p-4 border-t border-slate-200 space-y-1">
        <a href="#" class="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors">
          <Settings class="w-4 h-4 text-slate-400" />
          设置选项
        </a>
        <a href="#" class="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors">
          <HelpCircle class="w-4 h-4 text-slate-400" />
          报告一个错误
        </a>
        <div class="mt-4 flex items-center gap-3 px-3 py-2">
          <div class="w-8 h-8 rounded-full bg-slate-300 overflow-hidden shrink-0">
            <img src="https://i.pravatar.cc/150?img=11" alt="User" class="w-full h-full object-cover"/>
          </div>
          <div class="flex flex-col overflow-hidden">
            <span class="text-xs text-slate-700 font-medium truncate">admin@3dlearn.com</span>
            <span class="text-[10px] text-slate-400">Pro Plan</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
