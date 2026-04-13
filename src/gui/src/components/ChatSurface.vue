<template>
  <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#f5f3ef]">
    <div class="flex items-center justify-between border-b border-[rgba(160,120,80,0.12)] px-4 py-3 sm:px-5">
      <div class="flex items-center gap-2">
        <button type="button" class="rounded-xl p-2 text-[#5c4332] transition hover:bg-[rgba(160,120,80,0.08)] lg:hidden" @click="$emit('toggle-sidebar')">
          <PanelLeftOpen class="h-4 w-4" />
        </button>
        <div>
          <div class="text-[11px] uppercase tracking-[0.28em] text-[rgba(92,67,50,0.45)]">Workspace</div>
          <div class="text-base font-semibold text-[#2a1f13]">会话 #{{ conversation?.id || "-" }}</div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="hidden rounded-2xl border border-[rgba(160,120,80,0.16)] bg-white px-3 py-2 text-right sm:block">
          <div class="text-[11px] text-[rgba(0,0,0,0.32)]">{{ serverConfig?.model || "未配置模型" }}</div>
          <div class="text-xs text-[#3d2f1e]">{{ formatInteger(sessionUsage?.totalTokens || 0) }} tokens</div>
        </div>
        <button type="button" class="rounded-2xl border border-[rgba(160,120,80,0.16)] bg-white px-3 py-2 text-sm text-[#5c4332] transition hover:bg-[rgba(160,120,80,0.06)]" @click="$emit('open-settings')">
          设置
        </button>
      </div>
    </div>

    <div ref="msgBox" class="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]" style="scrollbar-color:rgba(160,120,80,0.2) transparent" @scroll="onScroll">
      <div class="mx-auto flex max-w-[820px] flex-col gap-0 px-5 py-6">
        <div v-if="hasOlderMessages" class="py-2 text-center">
          <button type="button" class="rounded-full border border-[rgba(160,120,80,0.18)] bg-white px-3 py-1.5 text-xs text-[rgba(0,0,0,0.42)] transition hover:bg-[rgba(160,120,80,0.06)] disabled:opacity-50" :disabled="isLoadingOlder" @click="$emit('load-older')">
            {{ isLoadingOlder ? "加载中..." : "加载更早消息" }}
          </button>
        </div>

        <div v-if="!displayMessages.length" class="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <div class="mb-4 text-[40px]">💬</div>
          <h2 class="mb-2 text-xl font-bold text-[#2a1f13]">开始一段新对话</h2>
          <p class="max-w-[360px] text-[13px] leading-relaxed text-[rgba(0,0,0,0.38)]">界面已切到 Vue，聊天区按照你给的 `chat.vue` 做了浅色纸感布局和工具调用折叠展示。</p>
        </div>

        <template v-else>
          <div v-for="(m, i) in displayMessages" :key="m._key || m._streamId || i" class="mb-5">
            <div v-if="m.role === 'user'" class="flex justify-end">
              <div class="max-w-[85%] overflow-x-auto rounded-[18px_18px_4px_18px] px-4 py-3 text-sm leading-relaxed" style="background:#e8e0d4;color:#2a1f13;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
                <div class="whitespace-pre-wrap [word-break:break-word]">{{ m.content }}</div>
              </div>
            </div>

            <div v-else-if="m.role === 'assistant' && m.type !== 'tool_call' && m.type !== 'tool_result'" class="flex items-start">
              <div class="min-w-0 flex-1">
                <div class="markdown-content overflow-x-auto rounded-[18px_18px_18px_4px] border border-[rgba(160,120,80,0.15)] bg-white px-4 py-3 text-[#3d2f1e] shadow-[0_1px_3px_rgba(0,0,0,0.06)]" v-html="renderMd(m.content)" />
                <div v-if="m.streaming" class="mt-2 text-xs text-[rgba(160,120,80,0.7)]">正在生成...</div>
              </div>
            </div>

            <div v-else-if="m.type === 'tool_call'" class="flex items-start gap-2.5">
              <div class="min-w-0 flex-1 overflow-hidden rounded-xl border border-[rgba(160,120,80,0.18)] bg-white">
                <button type="button" class="flex w-full items-center gap-2 border-none px-3 py-2 text-left transition-colors hover:bg-[rgba(160,120,80,0.09)]" style="background:rgba(160,120,80,0.05)" @click="m.expanded = !m.expanded">
                  <ChevronRight class="h-3 w-3 shrink-0 transition-transform" :class="m.expanded ? 'rotate-90' : ''" style="color:rgba(0,0,0,0.35)" />
                  <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#3d2f1e]">{{ m.title || "工具调用" }}</span>
                  <span v-if="m.result" class="shrink-0 text-[11px] text-[rgba(0,0,0,0.35)]">done</span>
                </button>
                <div v-if="m.expanded" class="border-t border-[rgba(160,120,80,0.12)]">
                  <div v-if="m.shell && m.command" class="overflow-x-auto whitespace-pre px-3 py-2.5 font-mono text-xs" style="background:rgba(160,120,80,0.04);color:#5c7a50"><span class="select-none" style="color:rgba(0,0,0,0.3)">$ </span>{{ m.command }}</div>
                  <div v-else-if="m.detail" class="overflow-x-auto whitespace-pre px-3 py-2.5 font-mono text-xs text-[#5c7a50]">{{ m.detail }}</div>
                  <div v-if="m.result" class="max-h-48 overflow-auto whitespace-pre px-3 py-2.5 font-mono text-[11px]" style="border-top:1px solid rgba(160,120,80,0.1);background:rgba(160,120,80,0.03);color:rgba(0,0,0,0.45)">{{ m.result }}</div>
                </div>
              </div>
            </div>

            <div v-else-if="m.type === 'tool_result'" class="flex items-start gap-2.5">
              <div class="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-[18px] bg-[rgba(160,120,80,0.05)] px-4 py-3 font-mono text-xs leading-relaxed text-[rgba(0,0,0,0.5)]">
                {{ m.content }}
              </div>
            </div>
          </div>

          <div v-if="isLoading && !hasStreamingAssistant" class="flex items-start">
            <div class="py-2 text-sm text-[rgba(160,120,80,0.6)]">AI 正在思考<span class="animate-pulse">...</span></div>
          </div>
        </template>
      </div>
    </div>

    <div class="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-0" style="background:linear-gradient(to top,#f5f3ef 60%,transparent)">
      <div class="mx-auto max-w-[820px]">
        <form class="relative flex flex-col rounded-2xl border border-[rgba(160,120,80,0.18)] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]" @submit.prevent="submit">
          <textarea
            ref="textarea"
            v-model="input"
            rows="1"
            :placeholder="isLoading ? '正在生成，可随时中断' : '输入消息...'"
            class="min-h-[56px] max-h-[220px] w-full resize-none overflow-y-auto border-none bg-transparent px-4 pb-3 pt-3.5 pr-14 text-sm leading-relaxed outline-none disabled:opacity-50"
            style="color:#2a1f13"
            @input="autoResize"
            @keydown.enter.exact.prevent="submit"
            @compositionstart="composing = true"
            @compositionend="composing = false"
          />

          <div class="px-3.5 pb-2.5">
            <div class="text-[11px] text-[rgba(0,0,0,0.3)]">Enter 发送，Shift+Enter 换行</div>
          </div>

          <div class="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
            <button v-if="isLoading" type="button" class="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-transparent bg-[#8b3a2e] text-white shadow-[0_2px_8px_rgba(139,58,46,0.28)] transition hover:bg-[#783126]" @click="$emit('stop')">
              <Square class="h-3.5 w-3.5 fill-current" />
            </button>
            <button v-else type="submit" :disabled="!canSend" class="flex h-[36px] w-[36px] items-center justify-center rounded-full border transition-all" :style="canSend ? 'cursor:pointer;border-color:transparent;background:#5c4332;color:#fff;box-shadow:0 2px 8px rgba(92,67,50,0.3)' : 'cursor:default;border-color:rgba(160,120,80,0.2);background:rgba(160,120,80,0.06);color:rgba(160,120,80,0.35)'">
              <ArrowUp class="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { marked } from "marked";
import { ArrowUp, ChevronRight, PanelLeftOpen, Square } from "lucide-vue-next";

marked.setOptions({ breaks: true, gfm: true });

const props = defineProps({
  conversation: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  sessionUsage: { type: Object, default: () => ({ totalTokens: 0 }) },
  serverConfig: { type: Object, default: () => ({}) },
  isLoading: { type: Boolean, default: false },
  hasOlderMessages: { type: Boolean, default: false },
  isLoadingOlder: { type: Boolean, default: false },
  wsStatus: { type: String, default: "disconnected" },
});

const emit = defineEmits(["send", "stop", "toggle-sidebar", "load-older", "open-settings"]);

const msgBox = ref(null);
const textarea = ref(null);
const input = ref("");
const composing = ref(false);
const nearBottom = ref(true);

const renderMd = (text) => marked.parse(text || "");
const displayMessages = computed(() => props.messages || []);
const canSend = computed(() => !!input.value.trim());
const hasStreamingAssistant = computed(() => displayMessages.value.some((item) => item.streaming));

const formatInteger = (value) => new Intl.NumberFormat("zh-CN").format(value || 0);

const autoResize = () => {
  const el = textarea.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
};

const scrollToBottom = async (behavior = "smooth") => {
  await nextTick();
  const el = msgBox.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior });
};

const onScroll = () => {
  const el = msgBox.value;
  if (!el) return;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  nearBottom.value = distanceFromBottom < 140;
};

const submit = () => {
  if (composing.value || !canSend.value) return;
  emit("send", input.value.trim());
  input.value = "";
  autoResize();
  void scrollToBottom();
};

watch(
  () => props.messages.length,
  async () => {
    if (nearBottom.value) {
      await scrollToBottom(props.isLoading ? "auto" : "smooth");
    }
  }
);

watch(
  () => props.conversation?.id,
  async () => {
    input.value = "";
    await nextTick();
    autoResize();
    nearBottom.value = true;
    await scrollToBottom("auto");
  },
  { immediate: true }
);
</script>
