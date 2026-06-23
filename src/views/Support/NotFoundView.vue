<script setup lang="ts">
import { Home, ArrowLeft } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div
    class="mobile-adaptive min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
    style="background-color: var(--bg-app)"
  >
    <!-- Decorative background elements -->
    <div class="hidden md:block">
      <div
        class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 glass-glow-xl rounded-full"
      ></div>
      <div
        class="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-600/10 glass-glow-lg rounded-full"
      ></div>
    </div>

    <div class="max-w-2xl w-full text-center relative z-10">
      <div class="inline-flex items-center justify-center w-24 h-24 bg-accent/10 rounded-3xl mb-8">
        <span class="text-5xl font-black text-accent">404</span>
      </div>

      <h1 class="text-4xl font-black mb-4 tracking-tight" style="color: var(--text-primary)">
        {{ $t('support.page_not_found') }}
      </h1>

      <p
        class="text-lg font-medium mb-12 max-w-lg mx-auto leading-relaxed"
        style="color: var(--text-secondary)"
      >
        {{ $t('support.page_not_found_desc') }}
      </p>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          type="button"
          class="px-8 py-3 bg-accent text-white rounded-2xl font-bold shadow-xl hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
          @click="router.push('/')"
        >
          <Home class="w-4 h-4" />
          {{ $t('support.back_to_home') }}
        </button>
        <button
          type="button"
          class="px-8 py-3 bg-white/5 border rounded-2xl font-bold hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
          style="border-color: var(--border-base); color: var(--text-primary)"
          @click="router.back()"
        >
          <ArrowLeft class="w-4 h-4" />
          {{ $t('support.back_to_previous') }}
        </button>
      </div>
    </div>
  </div>
</template>
