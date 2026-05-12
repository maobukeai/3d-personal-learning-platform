<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { 
  Search, 
  Send, 
  MoreVertical, 
  Phone, 
  Video, 
  Image as ImageIcon, 
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Plus,
  User as UserIcon,
  MessageSquare,
  X,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Box,
  Layout
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { socketService } from '@/utils/socket'

const authStore = useAuthStore()
const searchQuery = ref('')
const newMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const conversations = ref<any[]>([])
const messages = ref<any[]>([])
const activeConversation = ref<any>(null)
const isLoadingConversations = ref(false)
const isLoadingMessages = ref(false)
const isUploading = ref(false)

// User Profile Dialog
const isProfileDialogOpen = ref(false)
const selectedUserProfile = ref<any>(null)
const isLoadingProfile = ref(false)

const openUserProfile = async (userId: string) => {
  isProfileDialogOpen.value = true
  isLoadingProfile.value = true
  try {
    const response = await api.get(`/api/auth/users/${userId}`)
    selectedUserProfile.value = response.data
  } catch (error) {
    ElMessage.error('获取用户信息失败')
    isProfileDialogOpen.value = false
  } finally {
    isLoadingProfile.value = false
  }
}

// Message Search
const messageSearchQuery = ref('')

const filteredMessages = computed(() => {
  if (!messageSearchQuery.value.trim()) return messages.value
  const query = messageSearchQuery.value.toLowerCase()
  return messages.value.filter(m => 
    m.type === 'TEXT' && m.content && m.content.toLowerCase().includes(query)
  )
})

const filteredConversations = computed(() => {
  if (!conversations.value) return []
  if (!searchQuery.value.trim()) return conversations.value
  const query = searchQuery.value.toLowerCase()
  return conversations.value.filter(c => {
    const participant = getOtherParticipant(c)
    const name = c.isGroup ? c.name : participant?.name
    return (name || participant?.email || '').toLowerCase().includes(query)
  })
})

// Emojis
const showEmojiPicker = ref(false)
const commonEmojis = ['😊', '😂', '🤣', '😍', '😒', '👌', '😘', '👍', '🙌', '🎉', '🔥', '✨', '💻', '🎨', '🚀', '⭐']

const addEmoji = (emoji: string) => {
  newMessage.value += emoji
  showEmojiPicker.value = false
}

// New Conversation Dialog
const isNewChatDialogOpen = ref(false)
const userSearchQuery = ref('')
const publicUsers = ref<any[]>([])
const isLoadingUsers = ref(false)

const filteredPublicUsers = computed(() => {
  const query = userSearchQuery.value.toLowerCase()
  return publicUsers.value.filter(u => 
    (u.name || '').toLowerCase().includes(query) || 
    u.email.toLowerCase().includes(query)
  )
})

const fetchConversations = async () => {
  isLoadingConversations.value = true
  try {
    const response = await api.get('/api/messages/conversations')
    conversations.value = response.data
    if (conversations.value.length > 0 && !activeConversation.value) {
      selectConversation(conversations.value[0])
    }
  } catch (error) {
    console.error('Fetch conversations error:', error)
  } finally {
    isLoadingConversations.value = false
  }
}

const selectConversation = async (conv: any) => {
  if (activeConversation.value && activeConversation.value.id !== conv.id) {
    socketService.emit('leave_conversation', activeConversation.value.id)
  }
  activeConversation.value = conv
  fetchMessages(conv.id)
  socketService.emit('join_conversation', conv.id)
  
  // Mark as read
  if (conv.unreadCount > 0) {
    api.patch(`/api/messages/conversations/${conv.id}/read`)
    conv.unreadCount = 0
  }
}

const fetchMessages = async (id: string) => {
  isLoadingMessages.value = true
  try {
    const response = await api.get(`/api/messages/conversations/${id}/messages`)
    messages.value = response.data
    scrollToBottom()
  } catch (error) {
    console.error('Fetch messages error:', error)
  } finally {
    isLoadingMessages.value = false
  }
}

const handleSendMessage = async (type = 'TEXT', content?: string) => {
  if (!activeConversation.value) return
  
  const msgContent = content || newMessage.value
  if (!msgContent.trim() && type === 'TEXT') return
  
  if (type === 'TEXT') newMessage.value = ''

  try {
    await api.post('/api/messages/messages', {
      conversationId: activeConversation.value.id,
      content: msgContent,
      type
    })
  } catch (error) {
    ElMessage.error('消息发送失败')
    if (type === 'TEXT') newMessage.value = msgContent // Restore if failed
  }
}

const handleDeleteMessage = async (messageId: string) => {
  try {
    await api.delete(`/api/messages/messages/${messageId}`)
    // Message will be removed via socket event
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const file = input.files[0]
  const formData = new FormData()
  formData.append('message_file', file)

  isUploading.value = true
  try {
    const res = await api.post('/api/messages/upload', formData)
    const { url, type } = res.data
    handleSendMessage(type, url)
  } catch (error) {
    ElMessage.error('上传失败')
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const getOtherParticipant = (conv: any) => {
  if (!conv) return null
  return conv.participants.find((p: any) => p.id !== authStore.user?.id) || conv.participants[0]
}

const fetchPublicUsers = async () => {
  isLoadingUsers.value = true
  try {
    const response = await api.get('/api/auth/users/public')
    publicUsers.value = response.data.filter((u: any) => u.id !== authStore.user?.id)
  } catch (error) {
    console.error('Fetch users error:', error)
  } finally {
    isLoadingUsers.value = false
  }
}

const startNewChat = async (user: any) => {
  try {
    const response = await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false
    })
    isNewChatDialogOpen.value = false
    userSearchQuery.value = ''
    
    // Check if conversation already exists in our local list
    const existing = conversations.value.find(c => c.id === response.data.id)
    if (!existing) {
      conversations.value.unshift(response.data)
      selectConversation(response.data)
    } else {
      selectConversation(existing)
    }
  } catch (error) {
    ElMessage.error('创建对话失败')
  }
}

const openLink = (url: string) => {
  window.open(url, '_blank')
}

const isMessageRead = (msg: any) => {
  if (!activeConversation.value) return false
  // For 1:1, if readBy has any entry other than sender, it's read
  return msg.readBy && msg.readBy.length > 0
}

// Typing status
const isOtherTyping = ref(false)
let typingTimeout: any = null

const handleTyping = () => {
  if (!activeConversation.value) return
  socketService.emit('typing', {
    conversationId: activeConversation.value.id,
    isTyping: true
  })
  
  if (typingTimeout) clearTimeout(typingTimeout)
  typingTimeout = setTimeout(() => {
    socketService.emit('typing', {
      conversationId: activeConversation.value.id,
      isTyping: false
    })
  }, 2000)
}

const updateSidebarWithNewMessage = (message: any) => {
  const convIndex = conversations.value.findIndex(c => c.id === message.conversationId)
  if (convIndex !== -1) {
    const conv = conversations.value[convIndex]
    conv.messages = [message]
    conv.updatedAt = message.createdAt
    if (activeConversation.value?.id !== message.conversationId) {
      conv.unreadCount = (conv.unreadCount || 0) + 1
      authStore.incrementUnreadMessagesCount()
    }
    conversations.value.splice(convIndex, 1)
    conversations.value.unshift(conv)
  } else {
    // If it's a new conversation we don't have yet
    fetchConversations().then(() => {
      const total = conversations.value.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0)
      authStore.setUnreadMessagesCount(total)
    })
  }
}

onMounted(() => {
  fetchConversations()
  
  socketService.on('new_message', (message) => {
    if (activeConversation.value?.id === message.conversationId) {
      messages.value.push(message)
      scrollToBottom()
      // Mark as read
      api.patch(`/api/messages/conversations/${message.conversationId}/read`)
    }
    updateSidebarWithNewMessage(message)
  })

  socketService.on('message_received', ({ conversationId, message }) => {
    // This handles messages from OTHER conversations
    if (activeConversation.value?.id !== conversationId) {
      updateSidebarWithNewMessage(message)
    }
  })

  socketService.on('message_deleted', ({ messageId, conversationId }) => {
    if (activeConversation.value?.id === conversationId) {
      messages.value = messages.value.filter(m => m.id !== messageId)
    }
    // Update last message if needed
    const conv = conversations.value.find(c => c.id === conversationId)
    if (conv && conv.messages[0]?.id === messageId) {
      fetchConversations() // Re-fetch to get new last message
    }
  })

  socketService.on('messages_read', ({ conversationId, messageIds, userId }) => {
    if (activeConversation.value?.id === conversationId && userId !== authStore.user?.id) {
      // Update local messages read status
      messages.value = messages.value.map(m => {
        if (messageIds.includes(m.id)) {
          return {
            ...m,
            readBy: [...(m.readBy || []), { userId }]
          }
        }
        return m
      })
    }
  })

  socketService.on('user_typing', ({ userId, conversationId, isTyping }) => {
    if (activeConversation.value?.id === conversationId && userId !== authStore.user?.id) {
      isOtherTyping.value = isTyping
    }
  })
})

onUnmounted(() => {
  socketService.off('new_message')
  socketService.off('message_deleted')
  socketService.off('messages_read')
  socketService.off('user_typing')
  if (activeConversation.value) {
    socketService.emit('leave_conversation', activeConversation.value.id)
  }
})

watch(() => isNewChatDialogOpen.value, (val) => {
  if (val && publicUsers.value.length === 0) fetchPublicUsers()
})
</script>

<template>
  <div class="flex-1 flex h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Contacts Sidebar -->
    <div class="w-80 border-r flex flex-col shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="p-6 border-b" style="border-color: var(--border-base)">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-xl font-bold" style="color: var(--text-primary)">消息中心</h1>
          <button @click="isNewChatDialogOpen = true" class="p-2 bg-accent/10 text-accent rounded-xl hover:bg-accent hover:text-white transition-all">
            <Plus class="w-4 h-4" />
          </button>
        </div>
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-muted)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索联系人..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-full transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto scrollbar-hide">
        <div v-if="isLoadingConversations" class="p-10 text-center">
          <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">正在同步聊天记录</p>
        </div>
        
        <template v-else>
          <div 
            v-for="conv in filteredConversations" 
            :key="conv.id"
            @click="selectConversation(conv)"
            class="p-4 flex gap-3 cursor-pointer transition-all hover:opacity-80 relative"
            :class="activeConversation?.id === conv.id ? 'bg-accent-subtle' : ''"
          >
            <div v-if="activeConversation?.id === conv.id" class="absolute left-0 top-0 bottom-0 w-1 bg-accent"></div>
            
            <div class="relative shrink-0">
              <img :src="getOtherParticipant(conv)?.avatarUrl || `https://ui-avatars.com/api/?name=${getOtherParticipant(conv)?.name || getOtherParticipant(conv)?.email}`" 
                   @click.stop="openUserProfile(getOtherParticipant(conv)?.id)"
                   class="w-12 h-12 rounded-full border object-cover hover:ring-2 hover:ring-accent transition-all cursor-pointer" style="border-color: var(--border-base)" />
              <div v-if="!conv.isGroup && authStore.isUserOnline(getOtherParticipant(conv)?.id)" class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 rounded-full" style="border-color: var(--bg-card)"></div>
            </div>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-bold truncate pr-2" style="color: var(--text-primary)">
                  {{ conv.isGroup ? conv.name : getOtherParticipant(conv)?.name }}
                </span>
                <span class="text-[9px] font-medium shrink-0" style="color: var(--text-muted)">
                  {{ new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-xs truncate pr-4" style="color: var(--text-secondary)">
                  {{ conv.messages[0]?.content || '暂无消息' }}
                </p>
                <div v-if="conv.unreadCount > 0" class="shrink-0 min-w-[16px] h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {{ conv.unreadCount }}
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="filteredConversations.length === 0" class="py-20 text-center text-slate-400">
            <MessageSquare class="w-10 h-10 mx-auto mb-3 opacity-10" />
            <p class="text-xs">未找到匹配的对话</p>
          </div>
        </template>
      </div>
    </div>

    <!-- Chat Area -->
    <div class="flex-1 flex flex-col" style="background-color: var(--bg-app)">
      <template v-if="activeConversation">
        <!-- Chat Header -->
        <div class="h-16 border-b px-6 flex items-center justify-between shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="flex items-center gap-3">
            <img :src="getOtherParticipant(activeConversation)?.avatarUrl || `https://ui-avatars.com/api/?name=${getOtherParticipant(activeConversation)?.name || getOtherParticipant(activeConversation)?.email}`" 
                 @click="openUserProfile(getOtherParticipant(activeConversation)?.id)"
                 class="w-10 h-10 rounded-full border object-cover cursor-pointer hover:ring-2 hover:ring-accent transition-all" style="border-color: var(--border-base)" />
            <div>
              <p class="text-sm font-bold cursor-pointer hover:text-accent transition-colors" @click="openUserProfile(getOtherParticipant(activeConversation)?.id)" style="color: var(--text-primary)">
                {{ activeConversation.isGroup ? activeConversation.name : getOtherParticipant(activeConversation)?.name }}
              </p>
              <p v-if="isOtherTyping" class="text-[10px] text-accent font-bold animate-pulse">正在输入...</p>
              <p v-else class="text-[10px] font-bold flex items-center gap-1" :class="authStore.isUserOnline(getOtherParticipant(activeConversation)?.id) ? 'text-emerald-500' : 'text-slate-400'">
                <span class="w-1.5 h-1.5 rounded-full" :class="authStore.isUserOnline(getOtherParticipant(activeConversation)?.id) ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                {{ authStore.isUserOnline(getOtherParticipant(activeConversation)?.id) ? '在线' : '离线' }}
              </p>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <el-popover
              placement="bottom-end"
              :width="280"
              trigger="click"
              popper-style="padding: 12px; border-radius: 16px; border: 1px solid var(--border-base); background-color: var(--bg-card); box-shadow: var(--el-box-shadow-dark);"
            >
              <template #reference>
                <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all text-slate-400 mr-2">
                  <Search class="w-4 h-4" />
                </button>
              </template>
              <div class="relative">
                <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  v-model="messageSearchQuery"
                  type="text" 
                  placeholder="搜索聊天记录..." 
                  class="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  style="color: var(--text-primary)"
                />
              </div>
            </el-popover>
            <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-muted)"><Phone class="w-4 h-4" /></button>
            <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-muted)"><Video class="w-4 h-4" /></button>
            <div class="w-px h-4 mx-2" style="background-color: var(--border-base)"></div>
            <button class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-muted)"><MoreVertical class="w-4 h-4" /></button>
          </div>
        </div>

        <!-- Messages Area -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <div v-for="msg in filteredMessages" :key="msg.id" 
               class="flex group" :class="msg.senderId === authStore.user?.id ? 'justify-end' : 'justify-start'">
            
            <div class="flex gap-3 max-w-[70%]" :class="msg.senderId === authStore.user?.id ? 'flex-row-reverse' : ''">
              <img v-if="msg.senderId !== authStore.user?.id" 
                   @click="openUserProfile(msg.senderId)"
                   :src="msg.sender.avatarUrl || `https://ui-avatars.com/api/?name=${msg.sender.name || msg.sender.email}`" 
                   class="w-8 h-8 rounded-full self-end mb-1 shrink-0 object-cover cursor-pointer hover:ring-2 hover:ring-accent transition-all" />
              
              <div class="flex flex-col relative" :class="msg.senderId === authStore.user?.id ? 'items-end' : 'items-start'">
                <!-- Delete button -->
                <button 
                  v-if="msg.senderId === authStore.user?.id"
                  @click="handleDeleteMessage(msg.id)"
                  class="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 bg-rose-500/10 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                >
                  <X class="w-3 h-3" />
                </button>

                <!-- Message Content -->
                <div class="px-4 py-2.5 rounded-2xl text-sm shadow-sm"
                     :class="msg.senderId === authStore.user?.id ? 'bg-accent text-white rounded-br-none' : 'rounded-bl-none border'"
                     :style="msg.senderId !== authStore.user?.id ? 'background-color: var(--bg-card); color: var(--text-primary); border-color: var(--border-base)' : ''">
                  
                  <template v-if="msg.type === 'IMAGE'">
                    <img :src="api.defaults.baseURL + msg.content" class="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity" @click="openLink(api.defaults.baseURL + msg.content)" />
                  </template>
                  <template v-else-if="msg.type === 'FILE'">
                    <div class="flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded-xl border border-white/10">
                      <div class="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center text-accent">
                        <Paperclip class="w-5 h-5" />
                      </div>
                      <div class="flex-1 min-w-0 pr-4">
                        <p class="text-xs font-bold truncate">{{ msg.content.split('/').pop() }}</p>
                        <a :href="api.defaults.baseURL + msg.content" target="_blank" class="text-[10px] text-accent hover:underline font-bold">点击下载</a>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    {{ msg.content }}
                  </template>
                </div>

                <div class="flex items-center gap-1 mt-1 px-1">
                  <span class="text-[9px] font-medium text-slate-400">
                    {{ new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                  </span>
                  <template v-if="msg.senderId === authStore.user?.id">
                    <CheckCheck v-if="isMessageRead(msg)" class="w-3 h-3 text-accent" />
                    <Check v-else class="w-3 h-3 text-slate-400" />
                  </template>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="isLoadingMessages" class="text-center py-4">
            <span class="text-[10px] text-slate-400 animate-pulse">正在加载历史消息...</span>
          </div>
          <div v-if="filteredMessages.length === 0 && messageSearchQuery" class="text-center py-20 text-slate-400">
            <p class="text-xs">未找到匹配的搜索结果</p>
          </div>
        </div>

        <!-- Input Area -->
        <div class="p-6 border-t relative" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <!-- Emoji Picker -->
          <div v-if="showEmojiPicker" class="absolute bottom-full mb-4 left-6 p-4 rounded-3xl shadow-2xl border z-50 grid grid-cols-4 gap-2" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <button 
              v-for="emoji in commonEmojis" 
              :key="emoji"
              @click="addEmoji(emoji)"
              class="w-10 h-10 flex items-center justify-center text-xl hover:bg-accent-subtle rounded-xl transition-all"
            >
              {{ emoji }}
            </button>
          </div>

          <div class="flex items-end gap-3 p-2 rounded-2xl focus-within:ring-4 focus-within:ring-accent/20 transition-all border"
               style="background-color: var(--bg-app); border-color: var(--border-base)">
            
            <div class="flex items-center">
              <button @click="showEmojiPicker = !showEmojiPicker" class="p-2 hover:text-accent transition-colors" :class="showEmojiPicker ? 'text-accent' : ''" style="color: var(--text-muted)"><Smile class="w-5 h-5" /></button>
              <button @click="triggerFileUpload" class="p-2 hover:text-accent transition-colors" style="color: var(--text-muted)"><Paperclip class="w-5 h-5" /></button>
              <button @click="triggerFileUpload" class="p-2 hover:text-accent transition-colors" style="color: var(--text-muted)"><ImageIcon class="w-5 h-5" /></button>
            </div>
            
            <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload" />
            
            <textarea 
              v-model="newMessage"
              @input="handleTyping"
              @keydown.enter.prevent="handleSendMessage('TEXT')"
              placeholder="写下你的消息..." 
              rows="1"
              class="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32 scrollbar-hide"
              style="color: var(--text-primary)"
            ></textarea>
            
            <button 
              @click="handleSendMessage('TEXT')"
              :disabled="!newMessage.trim() || isUploading"
              class="p-2.5 bg-accent text-white rounded-xl hover:bg-accent transition-all shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center min-w-[40px]"
            >
              <div v-if="isUploading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <Send v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <div v-else class="flex-1 flex flex-col items-center justify-center p-12 text-center" style="background-color: var(--bg-app)">
        <div class="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mb-6">
          <MessageSquare class="w-10 h-10 text-accent opacity-20" />
        </div>
        <h2 class="text-xl font-bold mb-2" style="color: var(--text-primary)">开启新对话</h2>
        <p class="text-sm max-w-xs mx-auto mb-8" style="color: var(--text-secondary)">
          在左侧选择一个联系人开始聊天，或者点击加号查找新朋友。
        </p>
        <button @click="isNewChatDialogOpen = true" class="px-8 py-3 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all">
          寻找联系人
        </button>
      </div>
    </div>

    <!-- New Chat Dialog -->
    <el-dialog
      v-model="isNewChatDialogOpen"
      title="发起新聊天"
      width="440px"
      class="custom-dialog"
      :show-close="true"
      destroy-on-close
    >
      <div class="space-y-6">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            v-model="userSearchQuery"
            type="text" 
            placeholder="搜索用户姓名或邮箱..." 
            class="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" 
            style="color: var(--text-primary)" 
          />
        </div>

        <div class="max-h-80 overflow-y-auto scrollbar-hide space-y-2">
          <div v-if="isLoadingUsers" class="py-10 text-center">
            <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          </div>
          
          <div 
            v-for="user in filteredPublicUsers" 
            :key="user.id"
            @click.stop="startNewChat(user)"
            class="p-3 flex items-center gap-3 rounded-2xl hover:bg-accent/10 cursor-pointer transition-all group"
          >
            <img :src="user.avatarUrl || `https://ui-avatars.com/api/?name=${user.name || user.email}`" class="w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 object-cover" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold truncate" style="color: var(--text-primary)">{{ user.name || '未命名用户' }}</p>
              <p class="text-[10px] text-slate-400 truncate">{{ user.email }}</p>
            </div>
            <div class="w-8 h-8 rounded-full bg-accent/5 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
              <Plus class="w-4 h-4" />
            </div>
          </div>
          
          <div v-if="filteredPublicUsers.length === 0 && !isLoadingUsers" class="py-10 text-center text-slate-400">
            <UserIcon class="w-8 h-8 mx-auto mb-2 opacity-10" />
            <p class="text-xs">未找到匹配的用户</p>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- User Profile Dialog -->
    <el-dialog
      v-model="isProfileDialogOpen"
      width="440px"
      class="custom-dialog profile-dialog"
      :show-close="false"
      destroy-on-close
    >
      <div v-if="isLoadingProfile" class="py-20 text-center">
        <div class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
      <template v-else-if="selectedUserProfile">
        <!-- Profile Header -->
        <div class="h-32 bg-gradient-to-br from-accent to-indigo-600 relative -mx-8 -mt-6 mb-12">
          <button @click="isProfileDialogOpen = false" class="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-xl hover:bg-black/40 transition-all">
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="px-2 pb-2 -mt-20 relative">
          <img :src="selectedUserProfile.avatarUrl || `https://ui-avatars.com/api/?name=${selectedUserProfile.name || selectedUserProfile.email}`" class="w-24 h-24 rounded-3xl border-4 object-cover shadow-xl mb-4" style="border-color: var(--bg-card)" />
          <div class="flex items-center justify-between mb-2">
            <div>
              <h3 class="text-2xl font-bold" style="color: var(--text-primary)">{{ selectedUserProfile.name || '未命名用户' }}</h3>
              <p class="text-sm" style="color: var(--text-muted)">{{ selectedUserProfile.email }}</p>
            </div>
            <div class="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-bold">
              {{ selectedUserProfile.role === 'ADMIN' ? '管理员' : '正式成员' }}
            </div>
          </div>

          <p class="text-sm mt-4 mb-6 italic" style="color: var(--text-secondary)">
            {{ selectedUserProfile.bio || '这位小伙伴很神秘，什么都没写~' }}
          </p>

          <div class="grid grid-cols-2 gap-4 mb-8">
            <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
              <div class="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                <MapPin class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-slate-400 font-bold uppercase">所在地</p>
                <p class="text-xs font-bold truncate" style="color: var(--text-primary)">{{ selectedUserProfile.location || '未知' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
              <div class="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                <Calendar class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-slate-400 font-bold uppercase">加入时间</p>
                <p class="text-xs font-bold truncate" style="color: var(--text-primary)">{{ new Date(selectedUserProfile.createdAt).toLocaleDateString() }}</p>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="flex items-center justify-around py-6 border-y mb-8" style="border-color: var(--border-base)">
            <div class="text-center">
              <div class="flex items-center gap-2 mb-1 justify-center">
                <Box class="w-4 h-4 text-accent" />
                <span class="text-xl font-black" style="color: var(--text-primary)">{{ selectedUserProfile._count?.assets || 0 }}</span>
              </div>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">发布资产</p>
            </div>
            <div class="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
            <div class="text-center">
              <div class="flex items-center gap-2 mb-1 justify-center">
                <MessageSquare class="w-4 h-4 text-emerald-500" />
                <span class="text-xl font-black" style="color: var(--text-primary)">{{ selectedUserProfile._count?.discussions || 0 }}</span>
              </div>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">发起讨论</p>
            </div>
            <div v-if="selectedUserProfile.website" class="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
            <div v-if="selectedUserProfile.website" class="text-center">
              <a :href="selectedUserProfile.website" target="_blank" class="flex items-center gap-2 mb-1 justify-center group">
                <LinkIcon class="w-4 h-4 text-orange-500 group-hover:scale-110 transition-all" />
              </a>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">个人主页</p>
            </div>
          </div>

          <button 
            @click="startNewChat(selectedUserProfile); isProfileDialogOpen = false" 
            class="w-full py-4 bg-accent text-white rounded-2xl font-black shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare class="w-5 h-5" />
            立即联系
          </button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

<style>
.custom-dialog {
  border-radius: 2rem !important;
  overflow: hidden;
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-base) !important;
}
.custom-dialog .el-dialog__header {
  margin-right: 0;
  padding: 1.5rem 2rem 0;
}
.custom-dialog .el-dialog__title {
  font-weight: 800;
  color: var(--text-primary);
  font-size: 1.25rem;
}
.custom-dialog .el-dialog__body {
  padding: 1.5rem 2rem 2rem;
}
.custom-dialog .el-dialog__headerbtn {
  top: 1.5rem;
  right: 1.5rem;
  width: 2.5rem;
  height: 2.5rem;
  background-color: var(--bg-app);
  border-radius: 1rem;
  transition: all 0.3s;
}
.custom-dialog .el-dialog__headerbtn:hover {
  background-color: var(--accent);
}
.custom-dialog .el-dialog__headerbtn .el-dialog__close {
  color: var(--text-secondary);
}
.custom-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: white;
}
</style>
