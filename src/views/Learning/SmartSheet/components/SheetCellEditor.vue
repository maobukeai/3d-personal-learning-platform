<script setup lang="ts">
import { computed } from 'vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue';
import { Star, FileText, Image as ImageIcon, Plus } from 'lucide-vue-next';
import type { SheetColumnDef } from '../types/sheet';

const props = defineProps<{
  column: SheetColumnDef;
  modelValue: any;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: any): void;
  (e: 'open-rich-text', text: string): void;
  (e: 'open-image-lightbox', images: string[]): void;
}>();

const imagesList = computed<string[]>(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue;
  if (typeof props.modelValue === 'string' && props.modelValue.trim()) return [props.modelValue];
  return [];
});

const toggleMultiSelectOption = (optId: string) => {
  const list = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
  const idx = list.indexOf(optId);
  if (idx !== -1) {
    list.splice(idx, 1);
  } else {
    list.push(optId);
  }
  emit('update:modelValue', list);
};

const handleBatchFileSelect = (e: Event) => {
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
      emit('update:modelValue', [...imagesList.value, ...newImages]);
    });
  }
};

const handlePaste = (e: ClipboardEvent) => {
  if (props.column.type !== 'image') return;
  const items = e.clipboardData?.items;
  if (items) {
    const newPics: string[] = [];
    let processed = 0;
    let totalImgCount = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        totalImgCount++;
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (evt.target?.result) {
              newPics.push(evt.target.result as string);
            }
            processed++;
            if (processed === totalImgCount) {
              emit('update:modelValue', [...imagesList.value, ...newPics]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }
};
</script>

<template>
  <div class="w-full text-xs min-h-[36px] flex items-center" @paste="handlePaste">
    <!-- 1. Text -->
    <template v-if="column.type === 'text'">
      <input
        :value="modelValue || ''"
        type="text"
        class="w-full bg-transparent px-2 py-1 outline-none border border-transparent focus:border-blue-500/50 focus:bg-white/5 rounded text-neutral-100"
        placeholder="输入文本..."
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </template>

    <!-- 2. Number -->
    <template v-else-if="column.type === 'number'">
      <input
        :value="modelValue !== undefined && modelValue !== null ? modelValue : ''"
        type="number"
        class="w-full bg-transparent px-2 py-1 outline-none border border-transparent focus:border-blue-500/50 focus:bg-white/5 rounded text-neutral-100 font-mono"
        placeholder="0.00"
        @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      />
    </template>

    <!-- 3. Checkbox -->
    <template v-else-if="column.type === 'checkbox'">
      <div class="px-2 flex items-center justify-center w-full">
        <Checkbox
          :model-value="Boolean(modelValue)"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </div>
    </template>

    <!-- 4. Select -->
    <template v-else-if="column.type === 'select'">
      <select
        :value="modelValue || ''"
        class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" class="bg-neutral-900 text-neutral-400">未选择</option>
        <option
          v-for="opt in column.options || []"
          :key="opt.id"
          :value="opt.id"
          class="bg-neutral-900 text-neutral-100"
        >
          {{ opt.label }}
        </option>
      </select>
    </template>

    <!-- 5. Multi Select -->
    <template v-else-if="column.type === 'multi-select'">
      <div class="flex flex-wrap gap-1 p-1 w-full">
        <span
          v-for="opt in column.options || []"
          :key="opt.id"
          :class="[
            'text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-opacity border',
            (Array.isArray(modelValue) ? modelValue : []).includes(opt.id)
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 opacity-100 font-medium'
              : 'bg-white/5 text-neutral-400 border-white/5 opacity-40 hover:opacity-80',
          ]"
          @click="toggleMultiSelectOption(opt.id)"
        >
          #{{ opt.label }}
        </span>
      </div>
    </template>

    <!-- 6. Date -->
    <template v-else-if="column.type === 'date'">
      <CustomDatePicker
        :model-value="modelValue || ''"
        placeholder="选择日期"
        size="sm"
        @update:model-value="emit('update:modelValue', String($event))"
      />
    </template>

    <!-- 7. Rating -->
    <template v-else-if="column.type === 'rating'">
      <div class="flex items-center gap-1 px-2">
        <Star
          v-for="star in 5"
          :key="star"
          :class="[
            'w-3.5 h-3.5 cursor-pointer transition-transform hover:scale-110',
            star <= (Number(modelValue) || 0)
              ? 'text-amber-400 fill-amber-400'
              : 'text-neutral-600 hover:text-amber-400/50',
          ]"
          @click="emit('update:modelValue', star)"
        />
      </div>
    </template>

    <!-- 8. Rich Text -->
    <template v-else-if="column.type === 'rich-text'">
      <div
        class="px-2 py-1 w-full truncate text-neutral-300 cursor-pointer hover:bg-white/5 rounded flex items-center justify-between group"
        @click="emit('open-rich-text', String(modelValue || ''))"
      >
        <span class="truncate">{{ modelValue || '点击填写心得...' }}</span>
        <FileText class="w-3 h-3 text-neutral-500 group-hover:text-blue-400 shrink-0 ml-1" />
      </div>
    </template>

    <!-- 9. 📸 Image Column (Multi-Image Gallery Array Support) -->
    <template v-else-if="column.type === 'image'">
      <div class="p-1 w-full flex items-center gap-1.5 overflow-hidden">
        <template v-if="imagesList.length > 0">
          <div
            class="flex items-center gap-1 cursor-pointer group/imgs"
            title="点击打开全屏多图画廊灯箱"
            @click="emit('open-image-lightbox', imagesList)"
          >
            <!-- 平铺展示前 3 张微缩图 -->
            <div
              v-for="(imgSrc, idx) in imagesList.slice(0, 3)"
              :key="idx"
              class="w-8 h-8 rounded border border-white/20 bg-black/40 overflow-hidden shrink-0 group-hover/imgs:border-blue-400 transition-colors"
            >
              <img :src="imgSrc" class="w-full h-full object-cover" />
            </div>

            <!-- 超出 3 张展示 +N 角标 -->
            <span
              v-if="imagesList.length > 3"
              class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30"
            >
              +{{ imagesList.length - 3 }}
            </span>
          </div>
        </template>

        <label class="cursor-pointer">
          <div
            class="px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-dashed border-white/15 text-[10px] text-neutral-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            <ImageIcon class="w-3 h-3" />
            {{ imagesList.length ? '+' : '+ 照片' }}
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="handleBatchFileSelect"
          />
        </label>
      </div>
    </template>
  </div>
</template>
