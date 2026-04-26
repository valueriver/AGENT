<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { marked } from "marked";
import { api, streamChat } from "../api.js";
import {
  buildToolMessage,
  formatTime,
  normalizeForDisplay,
  previewText,
  titleFromPrompt,
} from "../lib/messages.js";
import {
  conversationState,
  setCurrentConversation,
  clearCurrentConversation,
} from "../state/conversation.js";
import {
  layoutState,
  toggleChatList,
  closeMobileChatList,
} from "../state/layout.js";

marked.setOptions({ breaks: true, gfm: true });

const stripControlTags = (text) =>
  String(text || "")
    .replace(/<summary>[\s\S]*?<\/summary>/g, "")
    .replace(/<memo>[\s\S]*?<\/memo>/g, "");

const renderMd = (text) => marked.parse(stripControlTags(text));

const conversations = ref([]);
const messages = ref([]);
const search = ref("");
const prompt = ref("");
const sending = ref(false);
const errorText = ref("");

const msgBox = ref(null);
const promptEl = ref(null);
const stick = ref(true);
const showScrollDown = ref(false);
const abortController = ref(null);
const menuOpen = ref(false);

const toggleMenu = (e) => {
  e.stopPropagation();
  menuOpen.value = !menuOpen.value;
};
const closeMenu = () => { menuOpen.value = false; };

onMounted(() => {
  document.addEventListener("click", closeMenu);
});
onUnmounted(() => {
  document.removeEventListener("click", closeMenu);
});

const isNearBottom = () => {
  const el = msgBox.value;
  if (!el) return true;
  return el.scrollHeight - el.clientHeight - el.scrollTop < 120;
};

const scrollToBottom = (smooth = false) => {
  const el = msgBox.value;
  if (!el) return;
  if (smooth) {
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  } else {
    el.scrollTop = el.scrollHeight;
  }
};

const onScroll = () => {
  const near = isNearBottom();
  stick.value = near;
  showScrollDown.value = !near && messages.value.length > 0;
};

const scrollSignature = computed(() => {
  const list = messages.value;
  const last = list[list.length - 1];
  let lastLen = 0;
  if (last) {
    if (last.role === "tool") lastLen = String(last.result || "").length;
    else lastLen = String(last.content || "").length;
  }
  return `${list.length}:${lastLen}`;
});

watch(scrollSignature, () => {
  if (!stick.value) return;
  nextTick(() => scrollToBottom(false));
});

// textarea auto-grow
const autoGrow = () => {
  const el = promptEl.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 240) + "px";
};
watch(prompt, () => nextTick(autoGrow));

const selectedId = computed(() => conversationState.currentId);
const selectedConv = computed(() => conversationState.current);

const headerTitle = computed(() =>
  selectedConv.value?.title
    ? selectedConv.value.title
    : selectedConv.value
      ? `会话 #${selectedConv.value.id}`
      : "新会话",
);

const refreshConversations = async () => {
  const result = await api.listConversations(search.value.trim());
  conversations.value = result.conversations || [];
  if (!selectedId.value && conversations.value.length > 0) {
    await selectConversation(conversations.value[0].id);
  } else if (selectedId.value) {
    const conv = conversations.value.find((c) => c.id === selectedId.value);
    if (conv) setCurrentConversation(conv.id, conv);
  }
};

const refreshMessages = async () => {
  if (!selectedId.value) {
    messages.value = [];
    return;
  }
  const result = await api.listMessages(selectedId.value);
  messages.value = normalizeForDisplay(result.messages || []);
  stick.value = true;
  nextTick(() => scrollToBottom(false));
};

const selectConversation = async (id) => {
  const conv = conversations.value.find((c) => c.id === id) || null;
  setCurrentConversation(id, conv);
  await refreshMessages();
};

const startConversation = async () => {
  const result = await api.createConversation("新会话");
  await refreshConversations();
  if (result.conversation?.id) {
    await selectConversation(result.conversation.id);
    messages.value = [];
  }
};

const removeConversation = async (id) => {
  if (!window.confirm("删除此会话？")) return;
  await api.deleteConversation(id);
  if (selectedId.value === id) {
    clearCurrentConversation();
    messages.value = [];
  }
  await refreshConversations();
};

const selectFromSheet = async (id) => {
  await selectConversation(id);
  closeMobileChatList();
};

const newFromSheet = async () => {
  await startConversation();
  closeMobileChatList();
};

const findStreamingAssistant = () => {
  for (let i = messages.value.length - 1; i >= 0; i -= 1) {
    const m = messages.value[i];
    if (m.role === "assistant" && m.streaming) return i;
  }
  return -1;
};

const endStreamingAssistant = () => {
  const idx = findStreamingAssistant();
  if (idx >= 0) messages.value[idx].streaming = false;
};

const toggleTool = (id) => {
  const idx = messages.value.findIndex((m) => m._id === id);
  if (idx < 0) return;
  messages.value[idx].expanded = !messages.value[idx].expanded;
};

const sendPrompt = async () => {
  const text = prompt.value.trim();
  if (!text || sending.value) return;

  sending.value = true;
  errorText.value = "";

  try {
    let conversationId = selectedId.value;
    if (!conversationId) {
      const result = await api.createConversation(titleFromPrompt(text));
      conversationId = result.conversation?.id;
      if (!conversationId) throw new Error("failed to create conversation");
      await refreshConversations();
      await selectConversation(conversationId);
    }

    messages.value = [
      ...messages.value,
      { role: "user", content: text, _id: `local:${Date.now()}:u` },
    ];
    prompt.value = "";
    nextTick(autoGrow);
    stick.value = true;

    const controller = new AbortController();
    abortController.value = controller;

    await streamChat({
      conversationId,
      prompt: text,
      signal: controller.signal,
      onEvent: (eventName, payload) => {
        if (eventName === "delta") {
          let idx = findStreamingAssistant();
          if (idx < 0) {
            messages.value.push({
              role: "assistant",
              content: "",
              streaming: true,
              _id: `local:${Date.now()}:${Math.random()}:a`,
            });
            idx = messages.value.length - 1;
          }
          messages.value[idx].content =
            (messages.value[idx].content || "") + (payload.delta || "");
          return;
        }

        if (eventName === "tool_call") {
          endStreamingAssistant();
          messages.value.push(
            buildToolMessage(payload.toolCall, `local:${Date.now()}:${Math.random()}:tc`),
          );
          return;
        }

        if (eventName === "tool_result") {
          const content = payload.message?.content ?? "";
          const tcId = payload.message?.tool_call_id || "";
          let target = -1;
          if (tcId) {
            for (let i = messages.value.length - 1; i >= 0; i -= 1) {
              if (messages.value[i].role === "tool" && messages.value[i].toolCallId === tcId) {
                target = i; break;
              }
            }
          }
          if (target < 0) {
            for (let i = messages.value.length - 1; i >= 0; i -= 1) {
              if (messages.value[i].role === "tool" && messages.value[i].result == null) {
                target = i; break;
              }
            }
          }
          if (target >= 0) {
            messages.value[target].result = content;
          } else {
            messages.value.push({
              role: "tool",
              _id: `local:${Date.now()}:${Math.random()}:tr`,
              toolName: "tool",
              orphan: true,
              result: content,
              expanded: false,
            });
          }
          return;
        }

        if (eventName === "done") {
          const idx = findStreamingAssistant();
          if (idx >= 0) {
            messages.value[idx].streaming = false;
            if (payload.message?.memo) {
              messages.value[idx].memo = payload.message.memo;
            }
          }
          return;
        }

        if (eventName === "error") {
          throw new Error(payload.error || "stream error");
        }
      },
    });

    await refreshConversations();
    await refreshMessages();
  } catch (e) {
    if (e?.name !== "AbortError") {
      errorText.value = e.message || "发送失败";
    }
    endStreamingAssistant();
    await refreshMessages().catch(() => {});
  } finally {
    sending.value = false;
    abortController.value = null;
  }
};

const stopStream = () => {
  abortController.value?.abort();
};

const composing = ref(false);

const welcomeExamples = [
  { title: "看看当前目录", hint: "列出文件结构",
    prompt: "帮我看下当前目录里有哪些文件,大致是干什么的" },
  { title: "检查 Node 环境", hint: "版本与路径",
    prompt: "看一下 node 和 npm 版本,以及当前 PATH 里有哪些可执行文件位置" },
  { title: "统计代码量", hint: "按扩展名分类",
    prompt: "帮我按扩展名统计当前仓库的代码行数,忽略 node_modules 和 dist" },
  { title: "梳理仓库结构", hint: "快速了解项目",
    prompt: "简要说明这个仓库的目录结构和每个顶级目录的职责" },
];

const applyExample = (text) => {
  prompt.value = text;
  nextTick(() => { autoGrow(); promptEl.value?.focus(); });
};

const handlePromptKeydown = (event) => {
  if (event.key !== "Enter") return;
  if (event.shiftKey) return;
  if (composing.value || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  sendPrompt();
};

onMounted(async () => {
  await refreshConversations();
  if (selectedId.value) await refreshMessages();
  nextTick(() => { scrollToBottom(false); autoGrow(); });
});
</script>

<template>
  <div class="flex-1 min-h-0 min-w-0 flex relative">
    <!-- ────────────────────────────────────────────────────────
         Conversation list (left sub-nav, chat-ui style)
         ──────────────────────────────────────────────────────── -->
    <aside
      class="hidden md:flex flex-col min-h-0 overflow-hidden transition-[width] duration-300 ease-out shrink-0"
      :class="layoutState.chatListCollapsed ? 'md:w-0' : 'md:w-[280px]'"
      style="background: linear-gradient(to right, var(--nav-from), var(--nav-to)), var(--color-bg);"
    >
      <div class="w-[280px] flex flex-col min-h-0 flex-1">
        <!-- "新对话" + 搜索 -->
        <div class="flex flex-col gap-2.5 p-3">
          <button
            class="flex items-center justify-center gap-2 h-10 rounded-xl border border-border-soft bg-bg-raised text-text text-sm font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            @click="startConversation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                 stroke-linejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新对话
          </button>

          <div class="relative">
            <span
              class="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none grid place-items-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              v-model="search"
              class="input pl-9 !h-9 !rounded-lg"
              placeholder="搜索对话"
              @change="refreshConversations"
              @keydown.enter="refreshConversations"
            />
          </div>
        </div>

        <!-- list -->
        <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
          <button
            v-for="item in conversations"
            :key="item.id"
            class="conv-item group !h-9 !py-0 !flex-row !items-center !gap-2"
            :class="{ active: item.id === selectedId }"
            @click="selectConversation(item.id)"
          >
            <span class="flex-1 min-w-0 text-sm text-text truncate">
              {{ item.title || `会话 #${item.id}` }}
            </span>
            <span
              class="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-bg-active text-text-faint hover:text-danger"
              role="button"
              title="删除"
              @click.stop="removeConversation(item.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </span>
          </button>

          <div v-if="conversations.length === 0" class="empty mx-1 mt-2">
            <div class="text-text-dim font-medium">还没有对话</div>
            <div class="text-xxs text-text-faint">点击「新对话」开始</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- ────────────────────────────────────────────────────────
         Main chat area
         ──────────────────────────────────────────────────────── -->
    <section class="flex-1 flex flex-col min-h-0 min-w-0 relative">
      <!-- Top bar (desktop) -->
      <div
        class="hidden md:flex items-center justify-between gap-3 py-3 px-5 shrink-0"
      >
        <div class="flex items-center gap-2 min-w-0">
          <button
            class="btn btn-sm btn-ghost !px-2 !h-8 !w-8"
            :title="layoutState.chatListCollapsed ? '显示对话列表' : '隐藏对话列表'"
            @click="toggleChatList"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <strong class="text-sm font-semibold text-text truncate">
            {{ headerTitle }}
          </strong>
        </div>
        <div v-if="selectedId" class="relative">
          <button
            class="btn btn-sm btn-ghost !px-2 !h-8 !w-8"
            title="更多"
            @click="toggleMenu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 top-full mt-1 min-w-[160px] z-20 rounded-xl border border-border bg-bg-raised shadow-2xl overflow-hidden"
            @click.stop
          >
            <button
              class="flex items-center gap-2 w-full px-3.5 py-2 text-left text-sm text-danger hover:bg-bg-hover"
              @click="closeMenu(); removeConversation(selectedId);"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              删除对话
            </button>
          </div>
        </div>
      </div>

      <!-- Messages area -->
      <div
        ref="msgBox"
        class="flex-1 min-h-0 overflow-y-auto"
        @scroll="onScroll"
      >
        <div class="mx-auto max-w-3xl xl:max-w-4xl px-5 pt-2 pb-44 flex flex-col gap-6 sm:gap-7">
          <!-- ── 欢迎屏 ── -->
          <div
            v-if="messages.length === 0"
            class="flex-1 flex flex-col items-center justify-center gap-10 py-20 text-center min-h-[60vh]"
          >
            <div class="flex flex-col items-center gap-5">
              <div
                class="w-16 h-16 md:w-20 md:h-20 rounded-2xl grid place-items-center text-white font-bold text-3xl md:text-4xl tracking-tight"
                style="background: linear-gradient(135deg, #FFD21E 0%, #f59e0b 100%);
                       box-shadow: 0 16px 48px rgba(255, 210, 30, 0.4);"
              >
                A
              </div>
              <div class="flex flex-col gap-2">
                <h2 class="m-0 text-3xl md:text-4xl font-semibold text-text leading-tight tracking-tight">
                  AGENT
                </h2>
                <p class="m-0 text-base text-text-mute max-w-md leading-relaxed">
                  本地控制台 · 终端执行 · 浏览器操控 · 跨会话记忆
                </p>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl">
              <button
                v-for="ex in welcomeExamples"
                :key="ex.title"
                class="welcome-chip"
                @click="applyExample(ex.prompt)"
              >
                <span class="text-sm font-medium text-text">{{ ex.title }}</span>
                <span class="text-xs text-text-mute">{{ ex.hint }}</span>
              </button>
            </div>
          </div>

          <!-- ── 消息流 ── -->
          <template v-for="message in messages" :key="message._id">
            <!-- Tool block: BlockWrapper style (chat-ui) -->
            <div v-if="message.role === 'tool'" class="flex gap-3">
              <div class="flex w-[22px] flex-shrink-0 flex-col items-center pt-1">
                <div
                  class="relative z-0 flex h-[22px] w-[22px] items-center justify-center rounded-md ring-1 bg-bg-raised"
                  :style="{
                    'box-shadow': message.result == null ? `0 0 0 1px var(--color-accent-soft)` : '',
                  }"
                  style="--tw-ring-color: var(--color-border);"
                >
                  <svg
                    v-if="message.result != null"
                    width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                    stroke-linejoin="round" class="text-success"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span
                    v-else
                    class="w-2 h-2 rounded-full"
                    style="background: var(--color-accent); animation: pulse-dot 1.4s ease-in-out infinite;"
                  ></span>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="tool-card" :class="{ expanded: message.expanded }">
                  <button
                    type="button"
                    class="tool-card-head"
                    @click="toggleTool(message._id)"
                  >
                    <svg
                      class="tool-chevron shrink-0"
                      width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span class="flex-1 min-w-0 font-mono text-xs truncate">
                      {{ message.toolName }}
                      <span v-if="message.toolSub" class="text-text-faint ml-1">
                        · {{ message.toolSub }}
                      </span>
                    </span>
                    <span
                      v-if="message.result != null"
                      class="shrink-0 text-xxs text-text-faint"
                    >
                      完成
                    </span>
                    <span
                      v-else-if="!message.orphan"
                      class="shrink-0 text-xxs inline-flex items-center gap-1.5"
                      style="color: var(--color-accent);"
                    >
                      <span
                        class="w-2.5 h-2.5 rounded-full border-[1.5px] border-current/30 animate-[tool-spin_0.8s_linear_infinite]"
                        style="border-top-color: currentColor;"
                      ></span>
                      执行中
                    </span>
                  </button>

                  <template v-if="message.expanded">
                    <div v-if="message.shell && message.command" class="tool-cmd">
                      <span class="tool-cmd-prompt">$ </span>{{ message.command }}
                    </div>
                    <pre v-else-if="message.args" class="tool-args">{{ message.args }}</pre>
                    <div v-else-if="!message.orphan" class="tool-args">
                      <span class="text-text-faint italic">(无参数)</span>
                    </div>

                    <pre v-if="message.result" class="tool-result">{{ message.result }}</pre>
                    <div
                      v-else-if="message.result === ''"
                      class="tool-result text-text-faint italic"
                    >(空输出)</div>
                  </template>
                </div>
              </div>
            </div>

            <!-- User message: right-aligned bubble (chat-ui style) -->
            <div v-else-if="message.role === 'user'" class="flex justify-end">
              <div
                class="msg-content max-w-[36rem]"
              >{{ message.content }}</div>
            </div>

            <!-- Assistant message: left avatar + bubble -->
            <article v-else class="flex gap-3 group">
              <div
                class="w-7 h-7 rounded-md grid place-items-center flex-shrink-0 mt-0.5 text-xs font-bold text-white"
                style="background: linear-gradient(135deg, #FFD21E 0%, #f59e0b 100%); color: #1a1a1a;"
              >A</div>
              <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                <div
                  class="msg-content msg-md md-prose"
                  v-html="renderMd(message.content)"
                />
                <div
                  v-if="message.memo"
                  class="inline-flex items-center gap-1 text-xxs"
                  style="color: var(--color-accent);"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round"
                       stroke-linejoin="round">
                    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <path d="M14 3v6h6" />
                  </svg>
                  {{ message.memo }}
                </div>
              </div>
            </article>
          </template>
        </div>
      </div>

      <!-- Scroll-to-bottom floating button -->
      <button
        v-if="showScrollDown"
        class="absolute bottom-[calc(var(--input-h,160px)+12px)] right-6 w-10 h-10 rounded-full border border-border bg-bg-raised shadow-lg flex items-center justify-center text-text-dim hover:text-text hover:bg-bg-hover transition-all z-10"
        title="滚动到最新"
        @click="scrollToBottom(true)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
             stroke-linejoin="round">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </button>

      <!-- ── Input area (chat-ui style: rounded + 圆形发送按钮) ── -->
      <div class="shrink-0 px-4 md:px-5 pb-4 md:pb-5 pt-2">
        <div class="mx-auto max-w-3xl xl:max-w-4xl flex flex-col gap-2">
          <p v-if="errorText" class="inline-error">{{ errorText }}</p>

          <form
            class="relative flex w-full items-end rounded-2xl border border-border bg-bg-raised transition-colors focus-within:border-accent shadow-sm"
            style="box-shadow: 0 1px 2px rgba(0,0,0,0.04);"
            @submit.prevent="sendPrompt"
          >
            <textarea
              ref="promptEl"
              v-model="prompt"
              rows="1"
              class="flex-1 bg-transparent border-0 outline-none resize-none text-text text-smd leading-[1.55] py-3.5 pl-4 pr-14 min-h-[52px] max-h-[240px] placeholder:text-text-faint"
              placeholder="问点什么…"
              @keydown="handlePromptKeydown"
              @input="autoGrow"
              @compositionstart="composing = true"
              @compositionend="composing = false"
            />

            <!-- Stop button (when streaming) -->
            <button
              v-if="sending"
              type="button"
              class="btn-circle absolute bottom-2.5 right-2.5 is-active"
              title="停止生成"
              @click="stopStream"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>
            <!-- Send button -->
            <button
              v-else
              type="submit"
              class="btn-circle absolute bottom-2.5 right-2.5"
              :class="{ 'is-active': prompt.trim() }"
              :disabled="!prompt.trim()"
              title="发送(Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                   stroke-linejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>

          <p class="text-xxs text-text-faint text-center">
            <kbd class="kbd">Enter</kbd> 发送 ·
            <kbd class="kbd">Shift</kbd>+<kbd class="kbd">Enter</kbd> 换行
          </p>
        </div>
      </div>
    </section>

    <!-- ── Mobile bottom sheet: 会话列表 ── -->
    <div
      v-if="layoutState.mobileChatListOpen"
      class="md:hidden fixed inset-0 z-50 flex flex-col"
    >
      <div class="flex-1 bg-black/60 backdrop-blur-sm" @click="closeMobileChatList"></div>
      <div
        class="bg-bg-raised rounded-t-3xl flex flex-col max-h-[85vh] min-h-[60vh] shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
      >
        <div class="flex justify-center pt-2.5 pb-1 shrink-0">
          <div class="w-10 h-1 rounded-full bg-border-strong"></div>
        </div>

        <div class="flex flex-col gap-2.5 p-3 shrink-0">
          <button
            class="flex items-center justify-center gap-2 h-10 rounded-xl border border-border-soft bg-bg text-text text-sm font-semibold hover:bg-bg-hover transition-colors"
            @click="newFromSheet"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                 stroke-linejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新对话
          </button>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              v-model="search"
              class="input pl-9 !h-9 !rounded-lg"
              placeholder="搜索对话"
              @change="refreshConversations"
              @keydown.enter="refreshConversations"
            />
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-0.5">
          <button
            v-for="item in conversations"
            :key="item.id"
            class="conv-item !h-10 !flex-row !items-center"
            :class="{ active: item.id === selectedId }"
            @click="selectFromSheet(item.id)"
          >
            <span class="flex-1 min-w-0 text-sm text-text truncate">
              {{ item.title || `会话 #${item.id}` }}
            </span>
          </button>

          <div v-if="conversations.length === 0" class="empty mx-1">
            <div class="text-text-dim font-medium">还没有对话</div>
            <div class="text-xxs text-text-faint">点击上方「新对话」</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
