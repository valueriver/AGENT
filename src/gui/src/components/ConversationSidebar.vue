<template>
  <aside class="flex h-full w-[300px] shrink-0 flex-col border-r border-[rgba(160,120,80,0.15)] bg-[rgba(255,252,246,0.92)] backdrop-blur">
    <div class="border-b border-[rgba(160,120,80,0.12)] px-4 py-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[11px] uppercase tracking-[0.28em] text-[rgba(92,67,50,0.45)]">AGENT</div>
          <h1 class="mt-1 text-lg font-semibold text-[#2a1f13]">Conversations</h1>
        </div>
        <button
          type="button"
          class="rounded-xl px-3 py-2 text-sm text-[#5c4332] transition hover:bg-[rgba(160,120,80,0.08)]"
          @click="$emit('close')"
        >
          <PanelLeftClose class="h-4 w-4 lg:hidden" />
          <span class="hidden lg:inline">收起</span>
        </button>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <button
          type="button"
          class="flex-1 rounded-2xl bg-[#5c4332] px-4 py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(92,67,50,0.18)] transition hover:opacity-90"
          @click="$emit('create-conversation')"
        >
          新建会话
        </button>
        <button
          type="button"
          class="rounded-2xl border border-[rgba(160,120,80,0.18)] bg-white px-3 py-3 text-[#5c4332] transition hover:bg-[rgba(160,120,80,0.06)]"
          @click="$emit('open-search')"
        >
          <Search class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div ref="scrollBox" class="min-h-0 flex-1 overflow-y-auto px-3 py-3" @scroll="handleScroll">
      <div v-if="!conversations.length" class="rounded-3xl border border-dashed border-[rgba(160,120,80,0.18)] px-4 py-10 text-center text-sm text-[rgba(92,67,50,0.55)]">
        还没有会话，先创建一个。
      </div>

      <div v-else class="space-y-2">
        <button
          v-for="conversation in conversations"
          :key="conversation.id"
          type="button"
          class="group w-full rounded-3xl border px-4 py-3 text-left transition"
          :class="activeConversationId === conversation.id ? 'border-[rgba(92,67,50,0.22)] bg-[#f1e7da] shadow-[0_10px_30px_rgba(92,67,50,0.08)]' : 'border-transparent bg-white/80 hover:border-[rgba(160,120,80,0.16)] hover:bg-white'"
          @click="$emit('select-conversation', conversation)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-[#2a1f13]">会话 #{{ conversation.id }}</div>
              <div class="mt-1 line-clamp-2 text-xs leading-5 text-[rgba(0,0,0,0.42)]">
                {{ conversation.preview || "暂无内容" }}
              </div>
            </div>
            <button
              type="button"
              class="rounded-full p-1.5 text-[rgba(0,0,0,0.32)] opacity-0 transition group-hover:opacity-100 hover:bg-[rgba(160,120,80,0.08)] hover:text-[#9f3a2f]"
              @click.stop="$emit('delete-conversation', conversation.id)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
          <div class="mt-3 flex items-center justify-between text-[11px] text-[rgba(0,0,0,0.32)]">
            <span>{{ conversation.messageCount || 0 }} 条消息</span>
            <span>{{ formatDate(conversation.lastModified) }}</span>
          </div>
        </button>
      </div>

      <div v-if="loadingMore" class="px-3 py-4 text-center text-xs text-[rgba(0,0,0,0.35)]">
        正在加载更多...
      </div>
    </div>

    <div class="border-t border-[rgba(160,120,80,0.12)] px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[11px] uppercase tracking-[0.2em] text-[rgba(92,67,50,0.4)]">Settings</div>
          <div class="mt-1 text-xs text-[rgba(0,0,0,0.35)]">
            {{ hasMore ? "继续下滑可加载更多会话" : `${conversations.length} 个会话` }}
          </div>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-2xl border border-[rgba(160,120,80,0.18)] bg-white px-3 py-2.5 text-sm text-[#5c4332] transition hover:bg-[rgba(160,120,80,0.06)]"
          @click="$emit('open-settings')"
        >
          <span class="inline-flex items-center gap-2">
            <Settings2 class="h-4 w-4" />
            设置
          </span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref } from "vue";
import { PanelLeftClose, Search, Settings2, Trash2 } from "lucide-vue-next";

defineProps({
  conversations: { type: Array, default: () => [] },
  activeConversationId: { type: String, default: "" },
  hasMore: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
});

const emit = defineEmits(["select-conversation", "create-conversation", "delete-conversation", "open-settings", "open-search", "load-more", "close"]);
const scrollBox = ref(null);

const handleScroll = () => {
  const el = scrollBox.value;
  if (!el) return;
  const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (remaining < 180) {
    emit("load-more");
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
</script>
