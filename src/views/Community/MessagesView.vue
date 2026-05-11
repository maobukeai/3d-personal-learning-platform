<script setup lang="ts">
import { ref } from 'vue'
import { 
  Search, 
  Send, 
  MoreVertical, 
  Phone, 
  Video, 
  Image as ImageIcon, 
  Paperclip,
  Smile,
  CheckCheck
} from 'lucide-vue-next'

const searchQuery = ref('')
const newMessage = ref('')

const contacts = [
  {
    id: 1,
    name: 'Sarah Chen',
    avatar: 'https://i.pravatar.cc/150?img=32',
    lastMessage: '那个灯光节点的参数我发你邮箱了，记得查收一下。',
    time: '14:20',
    unread: 2,
    online: true
  },
  {
    id: 2,
    name: 'Alex Rivera',
    avatar: 'https://i.pravatar.cc/150?img=12',
    lastMessage: '好的，明天下午我们开会讨论。',
    time: '昨天',
    unread: 0,
    online: true
  },
  {
    id: 3,
    name: 'David Wilson',
    avatar: 'https://i.pravatar.cc/150?img=13',
    lastMessage: '这个模型的拓扑结构还能优化吗？',
    time: '星期三',
    unread: 0,
    online: false
  },
  {
    id: 4,
    name: 'Emily Zhang',
    avatar: 'https://i.pravatar.cc/150?img=25',
    lastMessage: '恭喜你的作品入选了精选展示！',
    time: '2026/05/01',
    unread: 0,
    online: false
  }
]

const activeContact = ref(contacts[0])

const messages = ref([
  { id: 1, sender: 'Sarah', text: '嘿，最近在忙那个赛博朋克场景吗？', time: '14:05', isMine: false },
  { id: 2, sender: 'Me', text: '是的，正在调整霓虹灯的辉光效果。', time: '14:08', isMine: true },
  { id: 3, sender: 'Sarah', text: '我建议你可以尝试一下几何节点里的散布工具，效果会更自然。', time: '14:10', isMine: false },
  { id: 4, sender: 'Me', text: '好主意！我之前一直手动放，确实太慢了。', time: '14:12', isMine: true },
  { id: 5, sender: 'Sarah', text: '那个灯光节点的参数我发你邮箱了，记得查收一下。', time: '14:20', isMine: false },
])

const handleSendMessage = () => {
  if (!newMessage.value.trim()) return
  
  messages.value.push({
    id: Date.now(),
    sender: 'Me',
    text: newMessage.value,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isMine: true
  })
  
  newMessage.value = ''
}
</script>

<template>
  <div class="flex-1 flex h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Contacts Sidebar -->
    <div class="w-80 border-r flex flex-col shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="p-6 border-b" style="border-color: var(--border-base)">
        <h1 class="text-xl font-bold mb-4" style="color: var(--text-primary)">消息中心</h1>
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-muted)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索联系人或聊天记录..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-full transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto scrollbar-hide">
        <div 
          v-for="contact in contacts" 
          :key="contact.id"
          @click="activeContact = contact"
          class="p-4 flex gap-3 cursor-pointer transition-all hover:opacity-80 relative"
          :class="activeContact.id === contact.id ? 'bg-accent-subtle' : ''"
        >
          <div v-if="activeContact.id === contact.id" class="absolute left-0 top-0 bottom-0 w-1 bg-accent"></div>
          
          <div class="relative shrink-0">
            <img :src="contact.avatar" class="w-12 h-12 rounded-full border" style="border-color: var(--border-base)" />
            <div v-if="contact.online" class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 rounded-full" style="border-color: var(--bg-card)"></div>
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-bold" style="color: var(--text-primary)">{{ contact.name }}</span>
              <span class="text-[10px] font-medium" style="color: var(--text-muted)">{{ contact.time }}</span>
            </div>
            <div class="flex items-center justify-between">
              <p class="text-xs truncate pr-4" style="color: var(--text-secondary)">{{ contact.lastMessage }}</p>
              <span v-if="contact.unread > 0" class="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {{ contact.unread }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Area -->
    <div class="flex-1 flex flex-col" style="background-color: var(--bg-app)">
      <!-- Chat Header -->
      <div class="h-16 border-b px-6 flex items-center justify-between shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
        <div class="flex items-center gap-3">
          <img :src="activeContact.avatar" class="w-10 h-10 rounded-full border" style="border-color: var(--border-base)" />
          <div>
            <p class="text-sm font-bold" style="color: var(--text-primary)">{{ activeContact.name }}</p>
            <p class="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {{ activeContact.online ? '在线' : '离线' }}
            </p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-muted)"><Phone class="w-4 h-4" /></button>
          <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-muted)"><Video class="w-4 h-4" /></button>
          <div class="w-px h-4 mx-2" style="background-color: var(--border-base)"></div>
          <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-muted)"><MoreVertical class="w-4 h-4" /></button>
        </div>
      </div>

      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        <div v-for="msg in messages" :key="msg.id" 
             class="flex" :class="msg.isMine ? 'justify-end' : 'justify-start'">
          
          <div class="flex gap-3 max-w-[70%]" :class="msg.isMine ? 'flex-row-reverse' : ''">
            <img v-if="!msg.isMine" :src="activeContact.avatar" class="w-8 h-8 rounded-full self-end mb-1 shrink-0" />
            
            <div class="flex flex-col" :class="msg.isMine ? 'items-end' : 'items-start'">
              <div class="px-4 py-2.5 rounded-2xl text-sm shadow-sm"
                   :class="msg.isMine ? 'bg-accent text-white rounded-br-none' : 'rounded-bl-none border'"
                   :style="!msg.isMine ? 'background-color: var(--bg-card); color: var(--text-primary); border-color: var(--border-base)' : ''">
                {{ msg.text }}
              </div>
              <div class="flex items-center gap-1 mt-1 px-1">
                <span class="text-[10px] font-medium" style="color: var(--text-muted)">{{ msg.time }}</span>
                <CheckCheck v-if="msg.isMine" class="w-3 h-3 text-accent" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="p-6 border-t" style="background-color: var(--bg-card); border-color: var(--border-base)">
        <div class="flex items-end gap-3 p-2 rounded-2xl focus-within:ring-4 focus-within:ring-accent/20 transition-all border"
             style="background-color: var(--bg-app); border-color: var(--border-base)">
          <button class="p-2 hover:text-accent transition-colors" style="color: var(--text-muted)"><Smile class="w-5 h-5" /></button>
          <button class="p-2 hover:text-accent transition-colors" style="color: var(--text-muted)"><Paperclip class="w-5 h-5" /></button>
          <button class="p-2 hover:text-accent transition-colors" style="color: var(--text-muted)"><ImageIcon class="w-5 h-5" /></button>
          
          <textarea 
            v-model="newMessage"
            @keydown.enter.prevent="handleSendMessage"
            placeholder="写下你的消息..." 
            rows="1"
            class="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32 scrollbar-hide"
            style="color: var(--text-primary)"
          ></textarea>
          
          <button 
            @click="handleSendMessage"
            class="p-2.5 bg-accent text-white rounded-xl hover:bg-accent transition-all shadow-lg shadow-accent/20"
          >
            <Send class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
