<script setup lang="ts">
import { ref, watch } from 'vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import Button from '@/components/ui/Button.vue';
import { Plus, Trash2, Camera, DollarSign, Star, Tag, Calendar, FileText } from 'lucide-vue-next';
import type { SheetColumnDef, SheetColumnType, SelectOptionItem } from '../types/sheet';

const props = defineProps<{
  show: boolean;
  column?: SheetColumnDef | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'save',
    col: { id?: string; name: string; type: SheetColumnType; options?: SelectOptionItem[] },
  ): void;
}>();

const name = ref('');
const type = ref<SheetColumnType>('text');
const options = ref<{ id: string; label: string; color: string }[]>([]);

const colorOptions = ['blue', 'emerald', 'amber', 'rose', 'purple', 'cyan'];

watch(
  () => props.column,
  (val) => {
    if (val) {
      name.value = val.name;
      type.value = val.type;
      options.value = val.options
        ? val.options.map((o) => ({ id: o.id, label: o.label, color: o.color || 'blue' }))
        : [];
    } else {
      name.value = '新列';
      type.value = 'text';
      options.value = [
        { id: 'opt-1', label: '选项 A', color: 'blue' },
        { id: 'opt-2', label: '选项 B', color: 'emerald' },
      ];
    }
  },
  { immediate: true },
);

const applyQuickPreset = (presetName: string, presetType: SheetColumnType) => {
  name.value = presetName;
  type.value = presetType;
  if (presetType === 'select') {
    options.value = [
      { id: 'opt-1', label: '😊 良好', color: 'emerald' },
      { id: 'opt-2', label: '😐 平常', color: 'blue' },
      { id: 'opt-3', label: '😫 疲惫', color: 'amber' },
    ];
  }
};

const addOption = () => {
  options.value.push({
    id: 'opt-' + Date.now(),
    label: `选项 ${options.value.length + 1}`,
    color: colorOptions[options.value.length % colorOptions.length],
  });
};

const removeOption = (idx: number) => {
  options.value.splice(idx, 1);
};

const handleSave = () => {
  if (!name.value.trim()) return;

  emit('save', {
    ...(props.column?.id ? { id: props.column.id } : {}),
    name: name.value.trim(),
    type: type.value,
    options: type.value === 'select' || type.value === 'multi-select' ? options.value : undefined,
  });
};
</script>

<template>
  <Modal
    :show="show"
    :title="column ? '重命名 / 配置列字段' : '添加自定义列'"
    size="md"
    @close="emit('close')"
  >
    <div class="space-y-4 py-2 text-xs">
      <!-- 1-Click 常用预设列快捷添加 -->
      <div v-if="!column" class="space-y-1.5 pb-3 border-b border-white/10">
        <span class="font-medium text-neutral-400">⚡ 1-Click 快捷一键生成预设列</span>
        <div class="flex flex-wrap gap-1.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            class="h-7 text-[11px]"
            @click="applyQuickPreset('📸 照片/图文', 'image')"
          >
            <Camera class="w-3 h-3 mr-1 text-emerald-400" />
            照片/图文
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="h-7 text-[11px]"
            @click="applyQuickPreset('💰 金额/开销', 'number')"
          >
            <DollarSign class="w-3 h-3 mr-1 text-amber-400" />
            金额/开销
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="h-7 text-[11px]"
            @click="applyQuickPreset('⭐ 心情/评分', 'rating')"
          >
            <Star class="w-3 h-3 mr-1 text-yellow-400" />
            心情评分
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="h-7 text-[11px]"
            @click="applyQuickPreset('🏷️ 状态/分类', 'select')"
          >
            <Tag class="w-3 h-3 mr-1 text-purple-400" />
            分类标签
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="h-7 text-[11px]"
            @click="applyQuickPreset('📅 记录日期', 'date')"
          >
            <Calendar class="w-3 h-3 mr-1 text-blue-400" />
            记录日期
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="h-7 text-[11px]"
            @click="applyQuickPreset('📝 详细心得', 'rich-text')"
          >
            <FileText class="w-3 h-3 mr-1 text-cyan-400" />
            详细心得
          </Button>
        </div>
      </div>

      <div>
        <label class="block font-medium text-neutral-300 mb-1">列名称 *</label>
        <Input v-model="name" placeholder="例如: 随手照、消费金额、心情、打卡" size="sm" />
      </div>

      <div>
        <label class="block font-medium text-neutral-300 mb-1">字段数据类型</label>
        <Select v-model="type" size="sm">
          <SelectOption value="text" label="单行文本 (Text)" />
          <SelectOption value="image" label="📸 照片/图片文件 (Image)" />
          <SelectOption value="select" label="单选标签 (Select)" />
          <SelectOption value="multi-select" label="多选标签 (Multi-Select)" />
          <SelectOption value="number" label="数值 / 金额 (Number)" />
          <SelectOption value="date" label="日期 (Date)" />
          <SelectOption value="rating" label="星级评分 (1-5 Star)" />
          <SelectOption value="checkbox" label="完成勾选 (Checkbox)" />
          <SelectOption value="rich-text" label="长文本心得 (Rich Text)" />
        </Select>
      </div>

      <!-- 如果是单选/多选，配置选项列表 -->
      <div
        v-if="type === 'select' || type === 'multi-select'"
        class="space-y-2 pt-2 border-t border-white/10"
      >
        <div class="flex items-center justify-between">
          <label class="font-medium text-neutral-300">标签选项设置</label>
          <Button variant="outline" size="sm" class="h-6 px-2 text-[11px]" @click="addOption">
            <Plus class="w-3 h-3 mr-1" />
            加选项
          </Button>
        </div>

        <div class="space-y-2 max-h-44 overflow-y-auto pr-1">
          <div v-for="(opt, idx) in options" :key="opt.id" class="flex items-center gap-2">
            <Input v-model="opt.label" placeholder="选项名称" size="sm" class="flex-1" />
            <select
              v-model="opt.color"
              class="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-neutral-200 outline-none"
            >
              <option value="blue" class="bg-neutral-900 text-blue-400">蓝色</option>
              <option value="emerald" class="bg-neutral-900 text-emerald-400">绿色</option>
              <option value="amber" class="bg-neutral-900 text-amber-400">黄色</option>
              <option value="rose" class="bg-neutral-900 text-rose-400">红色</option>
              <option value="purple" class="bg-neutral-900 text-purple-400">紫色</option>
              <option value="cyan" class="bg-neutral-900 text-cyan-400">青色</option>
            </select>
            <button class="text-neutral-500 hover:text-red-400" @click="removeOption(idx)">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" @click="emit('close')">取消</Button>
        <Button variant="primary" size="sm" :disabled="!name.trim()" @click="handleSave">
          保存列设置
        </Button>
      </div>
    </template>
  </Modal>
</template>
