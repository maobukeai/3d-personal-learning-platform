<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import {
  Upload,
  Trash2,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-vue-next';
import { ElMessageBox } from '@/utils/feedbackBridge';

const props = defineProps<{
  show: boolean;
  images: string | string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update-images', images: string[]): void;
}>();

const currentIndex = ref(0);

const imageList = computed<string[]>(() => {
  if (Array.isArray(props.images)) return props.images;
  if (typeof props.images === 'string' && props.images.trim()) return [props.images];
  return [];
});

watch(
  () => props.show,
  (val) => {
    if (val) currentIndex.value = 0;
  },
);

const currentSrc = computed(() => imageList.value[currentIndex.value] || '');

const prevImage = () => {
  if (imageList.value.length === 0) return;
  currentIndex.value = (currentIndex.value - 1 + imageList.value.length) % imageList.value.length;
};

const nextImage = () => {
  if (imageList.value.length === 0) return;
  currentIndex.value = (currentIndex.value + 1) % imageList.value.length;
};

const handleBatchFiles = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length) {
    const files = Array.from(target.files);
    const readPromises = files.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target?.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises).then((newImages) => {
      const updated = [...imageList.value, ...newImages];
      emit('update-images', updated);
      currentIndex.value = updated.length - 1;
    });
    target.value = '';
  }
};

const handlePromptUrl = async () => {
  try {
    const { value } = await ElMessageBox.prompt('请输入新加的图片 URL 链接：', '添加网络图片', {
      confirmButtonText: '添加',
      cancelButtonText: '取消',
      inputPlaceholder: 'https://...',
    });
    if (value && value.trim()) {
      const updated = [...imageList.value, value.trim()];
      emit('update-images', updated);
      currentIndex.value = updated.length - 1;
    }
  } catch {
    // User cancelled
  }
};

const deleteCurrentImage = () => {
  if (imageList.value.length === 0) return;
  const updated = imageList.value.filter((_, idx) => idx !== currentIndex.value);
  emit('update-images', updated);
  if (currentIndex.value >= updated.length) {
    currentIndex.value = Math.max(0, updated.length - 1);
  }
};
</script>

<template>
  <Modal :show="show" title="多图高清画廊与相册管理" size="xl" @close="emit('close')">
    <div class="space-y-4 py-2 flex flex-col items-center justify-center">
      <!-- 大图展示区域与左右翻页按钮 -->
      <div
        class="relative w-full max-h-[65vh] h-[450px] overflow-hidden rounded-xl border border-white/10 bg-black/50 p-2 flex items-center justify-center group"
      >
        <template v-if="currentSrc">
          <img
            :src="currentSrc"
            class="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            alt="相册大图"
          />

          <!-- 翻页控制 -->
          <template v-if="imageList.length > 1">
            <button
              class="absolute left-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-all opacity-80 group-hover:opacity-100"
              title="上一张 (Left)"
              @click="prevImage"
            >
              <ChevronLeft class="w-6 h-6" />
            </button>
            <button
              class="absolute right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-all opacity-80 group-hover:opacity-100"
              title="下一张 (Right)"
              @click="nextImage"
            >
              <ChevronRight class="w-6 h-6" />
            </button>
          </template>
        </template>

        <div v-else class="text-neutral-500 text-xs">暂无照片，请点击下方批量添加</div>
      </div>

      <!-- 缩略图平铺条 -->
      <div
        v-if="imageList.length > 0"
        class="flex items-center gap-2 overflow-x-auto w-full py-1 max-w-full"
      >
        <div
          v-for="(img, idx) in imageList"
          :key="idx"
          :class="[
            'relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-all',
            idx === currentIndex
              ? 'border-blue-500 scale-105 shadow-md'
              : 'border-white/10 opacity-60 hover:opacity-100',
          ]"
          @click="currentIndex = idx"
        >
          <img :src="img" class="w-full h-full object-cover" />
        </div>
      </div>

      <!-- 操作工具栏 -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 w-full pt-2 border-t border-white/10"
      >
        <div class="flex items-center gap-2 text-xs text-neutral-400">
          <span>共 {{ imageList.length }} 张照片</span>
          <span v-if="imageList.length">（当前第 {{ currentIndex + 1 }} 张）</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <label class="cursor-pointer">
            <Button variant="primary" size="sm" as="span">
              <Plus class="w-4 h-4 mr-1" />
              批量追加照片
            </Button>
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleBatchFiles"
            />
          </label>

          <Button variant="outline" size="sm" @click="handlePromptUrl">
            <ExternalLink class="w-4 h-4 mr-1" />
            加图片 URL
          </Button>

          <a v-if="currentSrc" :href="currentSrc" download="photo.png" target="_blank">
            <Button variant="outline" size="sm">
              <Download class="w-4 h-4 mr-1" />
              下载当前图
            </Button>
          </a>

          <Button
            v-if="currentSrc"
            variant="ghost"
            size="sm"
            class="text-red-400 hover:bg-red-500/20"
            @click="deleteCurrentImage"
          >
            <Trash2 class="w-4 h-4 mr-1" />
            删除当前图
          </Button>
        </div>
      </div>
    </div>
  </Modal>
</template>
