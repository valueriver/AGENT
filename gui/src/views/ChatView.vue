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
const stick = ref(true);
const abortController = ref(null);
const menuOpen = ref(false);

const toggleMenu = (e) => {
  e.stopPropagation();
  menuOpen.value = !menuOpen.value;
};
const closeMenu = () => {
  menuOpen.value = false;
};

onMounted(() => {
  document.addEventListener("click", closeMenu);
});
onUnmounted(() => {
  document.removeEventListener("click", closeMenu);
});

const isNearBottom = () => {
  const el = msgBox.value;
  if (!el) return true;
  return el.scrollHeight - el.clientHeight - el.scrollTop < 80;
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
  stick.value = isNearBottom();
};

const scrollSignature = computed(() => {
  const list = messages.value;
  const last = list[list.length - 1];
  let lastLen = 0;
  if (last) {
    if (last.role === "tool") {
      lastLen = String(last.result || "").length;
    } else {
      lastLen = String(last.content || "").length;
    }
  }
  return `${list.length}:${lastLen}`;
});

watch(scrollSignature, () => {
  if (!stick.value) return;
  nextTick(() => scrollToBottom(false));
});

const selectedId = computed(() => conversationState.currentId);
const selectedConv = computed(() => conversationState.current);

const headerTitle = computed(() =>
  selectedConv.value?.title
    ? selectedConv.value.title
    : selectedConv.value
      ? `会话 #${selectedConv.value.id}`
      : "新会话",
);

const headerSub = computed(() => {
  if (!selectedConv.value) return "发送第一条消息后自动创建会话";
  return `#${selectedConv.value.id} · ${messages.value.length} 条消息`;
});

const roleLabel = (role) => {
  if (role === "user") return "你";
  if (role === "assistant") return "助手";
  if (role === "tool") return "工具";
  return role || "消息";
};

const roleInitial = (msg) => {
  if (msg.role === "user") return "U";
  if (msg.role === "tool") return "T";
  return "A";
};

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
      {
        role: "user",
        content: text,
        _id: `local:${Date.now()}:u`,
      },
    ];
    prompt.value = "";
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
            buildToolMessage(
              payload.toolCall,
              `local:${Date.now()}:${Math.random()}:tc`,
            ),
          );
          return;
        }

        if (eventName === "tool_result") {
          const content = payload.message?.content ?? "";
          const tcId = payload.message?.tool_call_id || "";
          let target = -1;
          if (tcId) {
            for (let i = messages.value.length - 1; i >= 0; i -= 1) {
              if (
                messages.value[i].role === "tool" &&
                messages.value[i].toolCallId === tcId
              ) {
                target = i;
                break;
              }
            }
          }
          if (target < 0) {
            for (let i = messages.value.length - 1; i >= 0; i -= 1) {
              if (
                messages.value[i].role === "tool" &&
                messages.value[i].result == null
              ) {
                target = i;
                break;
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
  {
    title: "看看当前目录",
    hint: "列出文件结构",
    prompt: "帮我看下当前目录里有哪些文件,大致是干什么的",
  },
  {
    title: "检查 Node 环境",
    hint: "版本与路径",
    prompt: "看一下 node 和 npm 版本,以及当前 PATH 里有哪些可执行文件位置",
  },
  {
    title: "统计代码量",
    hint: "按扩展名分类",
    prompt: "帮我按扩展名统计当前仓库的代码行数,忽略 node_modules 和 dist",
  },
  {
    title: "梳理仓库结构",
    hint: "快速了解项目",
    prompt: "简要说明这个仓库的目录结构和每个顶级目录的职责",
  },
];

const applyExample = (text) => {
  prompt.value = text;
};

const handlePromptKeydown = (event) => {
  if (event.key !== "Enter") return;
  if (event.shiftKey) return;
  // IME 组合态(中文拼音、日文等候选框)不触发发送。
  // event.isComposing 部分浏览器可能已在 compositionend 清掉,keyCode 229 是兜底。
  if (composing.value || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  sendPrompt();
};

onMounted(async () => {
  await refreshConversations();
  if (selectedId.value) {
    await refreshMessages();
  }
  nextTick(() => scrollToBottom(false));
});
</script>

<template>
  <div class="flex-1 min-h-0 min-w-0 flex relative">
    <aside
      class="hidden md:flex flex-col min-h-0 bg-bg-raised overflow-hidden transition-[width] duration-200 ease-out shrink-0"
      :class="
        layoutState.chatListCollapsed
          ? 'md:w-0'
          : 'md:w-[300px] md:border-r md:border-border-soft'
      "
    >
      <div class="w-[300px] flex flex-col min-h-0 flex-1">
        <div class="flex flex-col gap-2.5 p-3 border-b border-border-soft">
          <div class="flex items-center justify-between gap-2">
            <strong class="text-[13px] font-semibold">会话</strong>
            <button
              class="btn btn-sm btn-ghost"
              title="新建会话"
              @click="startConversation"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建
            </button>
          </div>

          <div class="relative">
            <span
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none grid place-items-center"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              v-model="search"
              class="input pl-8"
              placeholder="搜索会话"
              @change="refreshConversations"
              @keydown.enter="refreshConversations"
            />
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-1">
          <button
            v-for="item in conversations"
            :key="item.id"
            class="conv-item"
            :class="{ active: item.id === selectedId }"
            @click="selectConversation(item.id)"
          >
            <div
              class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ item.title || `会话 #${item.id}` }}
            </div>
            <div
              class="text-xs text-text-mute overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ previewText(item.preview || item.summary, "暂无消息") }}
            </div>
            <div
              class="flex justify-between items-center gap-1.5 text-xxs text-text-faint mt-0.5"
            >
              <span>{{ item.messageCount }} 条</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
          </button>

          <div v-if="conversations.length === 0" class="empty">
            <div class="text-text-dim font-medium">还没有会话</div>
            <div class="text-xs text-text-faint">
              点击「新建」或直接发送消息
            </div>
          </div>
        </div>
      </div>
    </aside>

    <section class="flex-1 flex flex-col min-h-0 min-w-0">
      <div
        class="hidden md:flex items-center justify-between gap-3 py-3.5 px-5 border-b border-border-soft shrink-0"
      >
        <div class="flex items-center gap-2 min-w-0">
          <button
            class="btn btn-sm btn-ghost !px-2"
            :title="layoutState.chatListCollapsed ? '显示会话列表' : '隐藏会话列表'"
            @click="toggleChatList"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <div class="flex flex-col min-w-0">
            <strong
              class="text-md font-semibold overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ headerTitle }}
            </strong>
            <span class="text-xs text-text-mute">{{ headerSub }}</span>
          </div>
        </div>
        <div v-if="selectedId" class="relative">
          <button
            class="btn btn-sm btn-ghost !px-2"
            title="更多"
            @click="toggleMenu"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 top-full mt-1 min-w-[160px] z-20 rounded-[10px] border border-border bg-bg-panel shadow-lg overflow-hidden"
            @click.stop
          >
            <button
              class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-danger hover:bg-bg-hover"
              @click="
                closeMenu();
                removeConversation(selectedId);
              "
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              删除会话
            </button>
          </div>
        </div>
      </div>

      <div
        ref="msgBox"
        class="flex-1 min-h-0 overflow-auto py-5 px-6 flex flex-col gap-3.5"
        @scroll="onScroll"
      >
        <template v-for="message in messages" :key="message._id">
          <div v-if="message.role === 'tool'" class="tool-row">
            <div class="tool-card" :class="{ expanded: message.expanded }">
              <button
                type="button"
                class="tool-card-head"
                @click="toggleTool(message._id)"
              >
                <svg
                  class="tool-chevron shrink-0"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span
                  class="flex-1 min-w-0 font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {{ message.toolName }}
                  <span v-if="message.toolSub" class="text-text-mute ml-1">
                    · {{ message.toolSub }}
                  </span>
                </span>
                <span
                  v-if="message.result != null"
                  class="shrink-0 text-xxs text-success inline-flex items-center gap-1"
                >
                  ✓ 完成
                </span>
                <span
                  v-else-if="!message.orphan"
                  class="shrink-0 text-xxs text-warning inline-flex items-center gap-1.5"
                >
                  <span
                    class="w-2.5 h-2.5 rounded-full border-[1.5px] border-warning/30 border-t-warning animate-[tool-spin_0.8s_linear_infinite]"
                  ></span>
                  执行中
                </span>
              </button>

              <template v-if="message.expanded">
                <div v-if="message.shell && message.command" class="tool-cmd">
                  <span class="tool-cmd-prompt">$ </span>{{ message.command }}
                </div>
                <pre
                  v-else-if="message.args"
                  class="tool-args"
                >{{ message.args }}</pre>
                <div v-else-if="!message.orphan" class="tool-args">
                  <span class="text-text-faint italic">(无参数)</span>
                </div>

                <pre
                  v-if="message.result"
                  class="tool-result"
                >{{ message.result }}</pre>
                <div
                  v-else-if="message.result === ''"
                  class="tool-result text-text-faint italic"
                >
                  (空输出)
                </div>
              </template>
            </div>
          </div>

          <article
            v-else
            class="msg"
            :class="`msg-${message.role || 'assistant'}`"
          >
            <div class="msg-avatar">{{ roleInitial(message) }}</div>
            <div class="msg-body">
              <div class="flex items-center gap-2 text-xs">
                <span class="font-semibold text-text capitalize">
                  {{ roleLabel(message.role) }}
                </span>
              </div>
              <div
                v-if="message.role === 'assistant'"
                class="msg-content msg-md"
                v-html="renderMd(message.content)"
              />
              <pre v-else class="msg-content">{{ message.content }}</pre>
              <span
                v-if="message.memo"
                class="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-accent"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
                  />
                  <path d="M14 3v6h6" />
                </svg>
                {{ message.memo }}
              </span>
            </div>
          </article>
        </template>

        <div
          v-if="messages.length === 0"
          class="flex-1 flex flex-col items-center justify-center gap-7 px-4 py-10"
        >
          <div class="flex flex-col items-center gap-4 text-center">
            <div
              class="w-14 h-14 rounded-2xl grid place-items-center text-white font-bold text-[22px] tracking-wider"
              style="
                background: linear-gradient(135deg, #7c8cff 0%, #a855f7 100%);
                box-shadow: 0 10px 30px rgba(124, 140, 255, 0.35);
              "
            >
              A
            </div>
            <div class="flex flex-col gap-1.5">
              <h2 class="m-0 text-[22px] font-semibold text-text leading-tight">
                今天想做点什么?
              </h2>
              <p class="m-0 text-sm text-text-mute max-w-[460px] leading-relaxed">
                我可以在你本机执行终端命令、读写文件,并通过锚点与摘要跨会话记忆。
                选一个开始,或直接在下方输入。
              </p>
            </div>
          </div>
          <div
            class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-[600px]"
          >
            <button
              v-for="ex in welcomeExamples"
              :key="ex.title"
              class="welcome-chip"
              @click="applyExample(ex.prompt)"
            >
              <span class="font-medium text-text">{{ ex.title }}</span>
              <span class="text-xxs text-text-mute">{{ ex.hint }}</span>
            </button>
          </div>
        </div>
      </div>

      <div
        class="shrink-0 py-3 px-5 border-t border-border-soft bg-bg flex flex-col gap-2"
      >
        <p v-if="errorText" class="inline-error">{{ errorText }}</p>
        <div
          class="relative bg-bg-panel border border-border rounded-[10px] transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(124,140,255,0.35)]"
        >
          <textarea
            v-model="prompt"
            class="w-full bg-transparent border-0 outline-none resize-none text-text text-[13.5px] leading-[1.55] font-sans py-3 pr-3 pl-3.5 pb-11 min-h-[96px] max-h-[320px]"
            placeholder="输入消息 …  Enter 发送 · Shift+Enter 换行"
            @keydown="handlePromptKeydown"
            @compositionstart="composing = true"
            @compositionend="composing = false"
          />
          <div
            class="absolute left-2.5 right-2.5 bottom-2 flex items-center justify-between gap-2 pointer-events-none"
          >
            <span class="text-[11.5px] text-text-faint pointer-events-auto">
              <kbd class="kbd">Enter</kbd> 发送 ·
              <kbd class="kbd">Shift</kbd><kbd class="kbd">Enter</kbd> 换行 ·
              {{ prompt.length }} 字
            </span>
            <button
              v-if="sending"
              class="btn btn-sm pointer-events-auto !bg-danger !border-danger !text-white hover:!bg-danger/90"
              title="停止生成"
              @click="stopStream"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
              停止
            </button>
            <button
              v-else
              class="btn btn-sm btn-primary pointer-events-auto"
              :disabled="!prompt.trim()"
              @click="sendPrompt"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              发送
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Mobile bottom sheet: 会话列表 -->
    <div
      v-if="layoutState.mobileChatListOpen"
      class="md:hidden fixed inset-0 z-50 flex flex-col"
    >
      <div
        class="flex-1 bg-black/60"
        @click="closeMobileChatList"
      ></div>
      <div
        class="bg-bg-raised rounded-t-2xl flex flex-col max-h-[85vh] min-h-[60vh] shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
      >
        <div class="flex justify-center pt-2 pb-1 shrink-0">
          <div class="w-10 h-1 rounded-full bg-border-strong"></div>
        </div>

        <div
          class="flex items-center justify-between gap-2 px-4 py-2 border-b border-border-soft shrink-0"
        >
          <strong class="text-[13px] font-semibold">会话</strong>
          <div class="flex items-center gap-2">
            <button
              class="btn btn-sm btn-primary"
              title="新建会话"
              @click="newFromSheet"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建
            </button>
            <button
              class="btn btn-sm btn-ghost !px-2"
              title="关闭"
              @click="closeMobileChatList"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="px-3 py-2 border-b border-border-soft shrink-0">
          <div class="relative">
            <span
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none grid place-items-center"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              v-model="search"
              class="input pl-8"
              placeholder="搜索会话"
              @change="refreshConversations"
              @keydown.enter="refreshConversations"
            />
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-1">
          <button
            v-for="item in conversations"
            :key="item.id"
            class="conv-item"
            :class="{ active: item.id === selectedId }"
            @click="selectFromSheet(item.id)"
          >
            <div
              class="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ item.title || `会话 #${item.id}` }}
            </div>
            <div
              class="text-xs text-text-mute overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ previewText(item.preview || item.summary, "暂无消息") }}
            </div>
            <div
              class="flex justify-between items-center gap-1.5 text-xxs text-text-faint mt-0.5"
            >
              <span>{{ item.messageCount }} 条</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
          </button>

          <div v-if="conversations.length === 0" class="empty">
            <div class="text-text-dim font-medium">还没有会话</div>
            <div class="text-xs text-text-faint">
              点击上方「新建」
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kbd {
  display: inline-block;
  padding: 1px 5px;
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-dim);
  margin: 0 1px;
}

.msg-md {
  white-space: normal;
  font-family: var(--font-sans);
  line-height: 1.6;
}
.msg-md :deep(p) {
  margin: 0.4em 0;
}
.msg-md :deep(p:first-child) {
  margin-top: 0;
}
.msg-md :deep(p:last-child) {
  margin-bottom: 0;
}
.msg-md :deep(h1),
.msg-md :deep(h2),
.msg-md :deep(h3),
.msg-md :deep(h4) {
  margin: 0.9em 0 0.4em;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
}
.msg-md :deep(h1) {
  font-size: 1.25em;
}
.msg-md :deep(h2) {
  font-size: 1.15em;
}
.msg-md :deep(h3) {
  font-size: 1.05em;
}
.msg-md :deep(h4) {
  font-size: 1em;
}
.msg-md :deep(h1:first-child),
.msg-md :deep(h2:first-child),
.msg-md :deep(h3:first-child),
.msg-md :deep(h4:first-child) {
  margin-top: 0;
}
.msg-md :deep(ul),
.msg-md :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.4em;
}
.msg-md :deep(li) {
  margin: 0.15em 0;
}
.msg-md :deep(li > p) {
  margin: 0.15em 0;
}
.msg-md :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border-soft);
  border-radius: 4px;
  padding: 0 5px;
  color: var(--color-text);
}
.msg-md :deep(pre) {
  margin: 0.6em 0;
  padding: 10px 12px;
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border-soft);
  border-radius: 8px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.55;
}
.msg-md :deep(pre code) {
  background: transparent;
  border: 0;
  padding: 0;
  font-size: inherit;
  color: var(--color-text);
}
.msg-md :deep(blockquote) {
  margin: 0.4em 0;
  padding: 2px 0 2px 12px;
  border-left: 3px solid var(--color-border-strong);
  color: var(--color-text-mute);
}
.msg-md :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.msg-md :deep(strong) {
  color: var(--color-text);
  font-weight: 600;
}
.msg-md :deep(em) {
  font-style: italic;
}
.msg-md :deep(hr) {
  border: 0;
  border-top: 1px solid var(--color-border-soft);
  margin: 0.8em 0;
}
.msg-md :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 0.94em;
}
.msg-md :deep(th),
.msg-md :deep(td) {
  border: 1px solid var(--color-border-soft);
  padding: 5px 9px;
  text-align: left;
}
.msg-md :deep(th) {
  background: var(--color-bg-inset);
  font-weight: 600;
}
.msg-md :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}
</style>
