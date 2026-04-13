<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(37,24,15,0.3)] p-4 pt-16 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="w-full max-w-2xl overflow-hidden rounded-[28px] border border-[rgba(160,120,80,0.18)] bg-[#fffaf4] shadow-[0_30px_80px_rgba(92,67,50,0.18)]">
      <div class="border-b border-[rgba(160,120,80,0.12)] p-4">
        <div class="flex items-center gap-3 rounded-2xl border border-[rgba(160,120,80,0.16)] bg-white px-4 py-3">
          <Search class="h-4 w-4 text-[rgba(0,0,0,0.32)]" />
          <input
            v-model.trim="query"
            type="text"
            autofocus
            placeholder="搜索对话内容"
            class="w-full bg-transparent text-sm text-[#2a1f13] outline-none placeholder:text-[rgba(0,0,0,0.26)]"
          />
        </div>
      </div>

      <div class="max-h-[60vh] overflow-y-auto p-3">
        <div v-if="loading" class="px-4 py-10 text-center text-sm text-[rgba(0,0,0,0.4)]">搜索中...</div>
        <div v-else-if="query && !results.length" class="px-4 py-10 text-center text-sm text-[rgba(0,0,0,0.4)]">没有匹配结果</div>
        <div v-else class="space-y-2">
          <button
            v-for="result in results"
            :key="result.id"
            type="button"
            class="w-full rounded-2xl border border-transparent bg-white px-4 py-3 text-left transition hover:border-[rgba(160,120,80,0.18)]"
            @click="$emit('select-conversation', result.conversationId)"
          >
            <div class="flex items-center gap-2 text-xs text-[rgba(0,0,0,0.35)]">
              <span class="rounded-full bg-[rgba(160,120,80,0.08)] px-2 py-0.5">{{ result.role === "user" ? "用户" : "AI" }}</span>
              <span>会话 #{{ result.conversationId }}</span>
            </div>
            <div class="mt-2 line-clamp-2 text-sm leading-6 text-[#3d2f1e]">{{ result.content }}</div>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-[rgba(160,120,80,0.12)] px-4 py-3 text-xs text-[rgba(0,0,0,0.38)]">
        <div>{{ page }} / {{ totalPages }}</div>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-xl px-3 py-2 transition hover:bg-[rgba(160,120,80,0.08)]" :disabled="page <= 1" @click="performSearch(page - 1)">上一页</button>
          <button type="button" class="rounded-xl px-3 py-2 transition hover:bg-[rgba(160,120,80,0.08)]" :disabled="page >= totalPages" @click="performSearch(page + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { Search } from "lucide-vue-next";
import { api } from "@/api";

const props = defineProps({
  open: { type: Boolean, default: false },
});

defineEmits(["close", "select-conversation"]);

const query = ref("");
const results = ref([]);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(false);
let searchTimer = null;

const performSearch = async (nextPage = 1) => {
  if (!query.value) {
    results.value = [];
    page.value = 1;
    totalPages.value = 1;
    return;
  }
  loading.value = true;
  try {
    const res = await api.search(query.value, nextPage);
    if (res.ok) {
      results.value = res.results || [];
      page.value = res.page || 1;
      totalPages.value = res.totalPages || 1;
    }
  } finally {
    loading.value = false;
  }
};

watch(query, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void performSearch(1);
  }, 250);
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    query.value = "";
    results.value = [];
    page.value = 1;
    totalPages.value = 1;
  }
);
</script>
