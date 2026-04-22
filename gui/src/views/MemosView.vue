<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api.js";
import { setCurrentConversation } from "../state/conversation.js";

const router = useRouter();

const memos = ref([]);
const errorText = ref("");

const refresh = async () => {
  errorText.value = "";
  try {
    const result = await api.listMemos();
    memos.value = result.memos || [];
  } catch (e) {
    errorText.value = e.message || "加载失败";
  }
};

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

const formatDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day} 周${WEEK[d.getDay()]}`;
};

const formatHM = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const groups = computed(() => {
  const map = new Map();
  for (const m of memos.value) {
    const d = new Date(m.createdAt);
    const ts = Number.isNaN(d.getTime()) ? 0 : d.getTime();
    const key =
      ts > 0
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : "unknown";
    if (!map.has(key)) {
      map.set(key, {
        key,
        display: ts > 0 ? formatDate(d) : "未知时间",
        sortTs: ts,
        items: [],
      });
    }
    map.get(key).items.push(m);
  }
  return [...map.values()].sort((a, b) => b.sortTs - a.sortTs);
});

const jumpToChat = (memo) => {
  if (!memo.conversationId) return;
  setCurrentConversation(memo.conversationId, {
    id: memo.conversationId,
    title: memo.chatTitle || "",
  });
  router.push({ name: "chat" });
};

onMounted(refresh);
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col gap-3.5 py-5 px-6 overflow-auto">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2.5 min-w-0">
        <h2 class="m-0 text-md font-semibold">便签</h2>
        <p class="m-0 text-xs text-text-mute">
          跨会话的时间轴 · 共 {{ memos.length }} 条
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-sm btn-ghost" @click="refresh">刷新</button>
      </div>
    </div>

    <p v-if="errorText" class="inline-error">{{ errorText }}</p>

    <div v-if="memos.length === 0 && !errorText" class="empty">
      <div class="text-text-dim font-medium">暂无便签</div>
      <div class="text-xs text-text-faint">
        助手在回复里写 &lt;memo&gt;…&lt;/memo&gt; 时会自动出现在这里
      </div>
    </div>

    <div v-else class="flex flex-col gap-7 max-w-[760px]">
      <section v-for="g in groups" :key="g.key" class="flex flex-col gap-3">
        <div
          class="sticky top-0 z-10 -mx-6 px-6 py-1 bg-bg/90 backdrop-blur
            text-xs font-semibold text-text-dim tracking-wide"
        >
          {{ g.display }}
        </div>

        <ol class="relative flex flex-col gap-4 pl-5">
          <span
            class="absolute left-[7px] top-1 bottom-1 w-px bg-border-strong"
            aria-hidden="true"
          ></span>
          <li
            v-for="m in g.items"
            :key="m.id"
            class="relative"
          >
            <span
              class="absolute -left-[17px] top-[7px] w-[9px] h-[9px] rounded-full bg-accent ring-4 ring-bg"
              aria-hidden="true"
            ></span>
            <div class="flex flex-col gap-1.5 py-0.5">
              <div class="flex items-baseline gap-2 text-xxs text-text-faint">
                <span class="font-mono">#{{ m.id }}</span>
                <span>{{ formatHM(m.createdAt) }}</span>
                <button
                  v-if="m.chatTitle"
                  class="text-accent hover:underline truncate max-w-[280px]"
                  :title="m.chatTitle"
                  @click="jumpToChat(m)"
                >
                  {{ m.chatTitle }}
                </button>
                <span v-else class="text-text-faint italic">任务产出</span>
              </div>
              <p class="m-0 text-sm text-text leading-relaxed break-words">
                {{ m.content }}
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
