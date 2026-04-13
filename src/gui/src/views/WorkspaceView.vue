<template>
  <div class="flex h-screen h-[100dvh] overflow-hidden bg-[#efe8df] text-[#2a1f13]">
    <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-[rgba(37,24,15,0.2)] lg:hidden" @click="sidebarOpen = false" />

    <div class="fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:relative" :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'">
      <ConversationSidebar
        :conversations="conversations"
        :active-conversation-id="activeConversationId"
        :has-more="hasMoreConversations"
        :loading-more="isLoadingMoreConversations"
        @select-conversation="selectConversation"
        @create-conversation="createConversation"
        @delete-conversation="deleteConversation"
        @open-settings="settingsOpen = true"
        @open-search="searchOpen = true"
        @load-more="loadMoreConversations"
        @close="sidebarOpen = false"
      />
    </div>

    <main class="flex min-h-0 min-w-0 flex-1">
      <ChatSurface
        :conversation="currentConversation"
        :messages="messages"
        :session-usage="sessionUsage"
        :server-config="serverConfig"
        :is-loading="isLoading"
        :has-older-messages="hasOlderMessages"
        :is-loading-older="isLoadingOlder"
        :ws-status="wsStatus"
        @send="sendMessage"
        @stop="stopMessage"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
        @load-older="loadOlderMessages"
        @open-settings="settingsOpen = true"
      />
    </main>

    <SettingsModal
      :open="settingsOpen"
      :current-config="serverConfig"
      @close="settingsOpen = false"
      @save="saveSettings"
    />

    <SearchModal
      :open="searchOpen"
      @close="searchOpen = false"
      @select-conversation="handleSearchSelect"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "@/api";
import ChatSurface from "@/components/ChatSurface.vue";
import ConversationSidebar from "@/components/ConversationSidebar.vue";
import SearchModal from "@/components/SearchModal.vue";
import SettingsModal from "@/components/SettingsModal.vue";

const MESSAGE_PAGE_SIZE = 50;
const EMPTY_USAGE = {
  promptTokens: 0,
  cachedPromptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  recordedResponses: 0,
};

const route = useRoute();
const router = useRouter();

const conversations = ref([]);
const messages = ref([]);
const sessionUsage = ref({ ...EMPTY_USAGE });
const serverConfig = ref({ apiUrl: "", apiKey: "", model: "", contextTurns: 10 });
const isLoading = ref(false);
const isLoadingOlder = ref(false);
const hasOlderMessages = ref(false);
const olderPage = ref(1);
const conversationPage = ref(1);
const conversationTotalPages = ref(1);
const isLoadingMoreConversations = ref(false);
const settingsOpen = ref(false);
const searchOpen = ref(false);
const sidebarOpen = ref(false);
const wsStatus = ref("disconnected");
const stream = ref(null);
const streamingAssistantId = ref(null);

const hasMoreConversations = computed(
  () => conversationPage.value < conversationTotalPages.value
);
const activeConversationId = computed(
  () => String(route.params.conversationId || "")
);
const currentConversation = computed(
  () =>
    conversations.value.find(
      (conversation) => String(conversation.id) === activeConversationId.value
    ) || (activeConversationId.value ? { id: activeConversationId.value } : null)
);

const normalizeUsage = (usage) => ({
  promptTokens: Math.max(0, Number(usage?.promptTokens) || 0),
  cachedPromptTokens: Math.max(0, Number(usage?.cachedPromptTokens) || 0),
  completionTokens: Math.max(0, Number(usage?.completionTokens) || 0),
  totalTokens: Math.max(0, Number(usage?.totalTokens) || 0),
  recordedResponses: Math.max(0, Number(usage?.recordedResponses) || 0),
});

const addUsage = (currentUsage, usage) => {
  const current = normalizeUsage(currentUsage);
  const next = normalizeUsage(usage);
  return {
    promptTokens: current.promptTokens + next.promptTokens,
    cachedPromptTokens: current.cachedPromptTokens + next.cachedPromptTokens,
    completionTokens: current.completionTokens + next.completionTokens,
    totalTokens: current.totalTokens + next.totalTokens,
    recordedResponses: current.recordedResponses + (next.totalTokens > 0 ? 1 : 0),
  };
};

const parseToolArguments = (raw) => {
  if (!raw) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
};

const mapHistoryMessages = (source) => {
  const list = [];
  for (const message of source || []) {
    if (message.role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      if (message.content) {
        list.push({ role: "assistant", content: message.content });
      }
      for (const toolCall of message.tool_calls) {
        const args = parseToolArguments(toolCall?.function?.arguments);
        list.push({
          role: "assistant",
          type: "tool_call",
          title: toolCall?.function?.name || "tool",
          shell: toolCall?.function?.name === "shell",
          command: args?.command || "",
          detail: args ? JSON.stringify(args, null, 2) : "",
          expanded: false,
        });
      }
      continue;
    }
    if (message.role === "tool") {
      for (let index = list.length - 1; index >= 0; index -= 1) {
        if (list[index].type === "tool_call" && !list[index].result) {
          list[index].result = message.content || "";
          break;
        }
      }
      continue;
    }
    if (message.role === "assistant") {
      list.push({ role: "assistant", content: message.content || "", usage: message.usage });
      continue;
    }
    if (message.role === "user") {
      list.push({ role: "user", content: message.content || "" });
    }
  }
  return list;
};

const loadConfig = async () => {
  const res = await api.getConfig();
  if (res.ok) {
    serverConfig.value = res.config;
  }
};

const mergeConversations = (incoming, mode = "replace") => {
  if (mode === "replace") {
    conversations.value = incoming;
    return;
  }

  const seen = new Set(conversations.value.map((item) => String(item.id)));
  const next = [...conversations.value];
  for (const item of incoming) {
    if (seen.has(String(item.id))) continue;
    seen.add(String(item.id));
    next.push(item);
  }
  conversations.value = next;
};

const loadConversations = async (page = 1, mode = "replace") => {
  const res = await api.getConversations(page);
  if (!res.ok) return;
  mergeConversations(res.conversations || [], mode);
  conversationPage.value = res.page || 1;
  conversationTotalPages.value = res.totalPages || 1;

  if (mode === "replace" && !activeConversationId.value) {
    if (conversations.value.length > 0) {
      await router.replace(`/conversation/${conversations.value[0].id}`);
      return;
    }
    const created = await api.createConversation();
    if (created.ok) {
      await loadConversations(1);
      await router.replace(`/conversation/${created.conversation.id}`);
    }
  }
};

const loadMoreConversations = async () => {
  if (isLoadingMoreConversations.value || !hasMoreConversations.value) return;
  isLoadingMoreConversations.value = true;
  try {
    await loadConversations(conversationPage.value + 1, "append");
  } finally {
    isLoadingMoreConversations.value = false;
  }
};

const loadLatestMessages = async (conversationId) => {
  const res = await api.getMessages(conversationId, 1, MESSAGE_PAGE_SIZE, "desc");
  if (!res.ok) return;
  messages.value = mapHistoryMessages([...(res.messages || [])].reverse());
  olderPage.value = 2;
  hasOlderMessages.value = (res.totalPages || 1) > 1;
};

const loadOlderMessages = async () => {
  if (!activeConversationId.value || isLoadingOlder.value || !hasOlderMessages.value) return;
  isLoadingOlder.value = true;
  try {
    const res = await api.getMessages(activeConversationId.value, olderPage.value, MESSAGE_PAGE_SIZE, "desc");
    if (res.ok) {
      messages.value = [
        ...mapHistoryMessages([...(res.messages || [])].reverse()),
        ...messages.value,
      ];
      olderPage.value += 1;
      hasOlderMessages.value = olderPage.value <= (res.totalPages || 1);
    }
  } finally {
    isLoadingOlder.value = false;
  }
};

const loadConversationStats = async (conversationId) => {
  const res = await api.getConversationStats(conversationId);
  sessionUsage.value = res.ok ? normalizeUsage(res.usage) : { ...EMPTY_USAGE };
};

const closeStream = () => {
  stream.value?.close?.();
  stream.value = null;
  wsStatus.value = "disconnected";
  streamingAssistantId.value = null;
};

const finalizeStreamingAssistant = () => {
  messages.value = messages.value.map((item) =>
    item._streamId === streamingAssistantId.value
      ? { ...item, streaming: false }
      : item
  );
  streamingAssistantId.value = null;
};

const createConversation = async () => {
  const res = await api.createConversation();
  if (!res.ok) return;
  await loadConversations(1, "replace");
  await router.push(`/conversation/${res.conversation.id}`);
  sidebarOpen.value = false;
};

const deleteConversation = async (conversationId) => {
  await api.deleteConversation(conversationId);
  conversations.value = conversations.value.filter(
    (item) => String(item.id) !== String(conversationId)
  );
  if (activeConversationId.value === String(conversationId)) {
    await router.replace("/");
  }
  if (conversations.value.length === 0 || !currentConversation.value) {
    await loadConversations(1, "replace");
  }
};

const selectConversation = async (conversation) => {
  sidebarOpen.value = false;
  await router.push(`/conversation/${conversation.id}`);
};

const handleSearchSelect = async (conversationId) => {
  searchOpen.value = false;
  await router.push(`/conversation/${conversationId}`);
};

const saveSettings = async (settings) => {
  const res = await api.setConfig(settings);
  if (res.ok) {
    serverConfig.value = { ...settings };
    settingsOpen.value = false;
  }
};

const sendMessage = async (content) => {
  if (!activeConversationId.value || !content.trim()) return;
  if (isLoading.value) return;
  if (!serverConfig.value.apiUrl || !serverConfig.value.apiKey || !serverConfig.value.model) {
    settingsOpen.value = true;
    return;
  }

  closeStream();
  isLoading.value = true;
  messages.value = [...messages.value, { role: "user", content: content.trim() }];
  wsStatus.value = "connecting";

  stream.value = api.streamEvents(
    activeConversationId.value,
    (type, data) => {
      if (type === "delta") {
        wsStatus.value = "connected";
        const streamId = streamingAssistantId.value || `assistant-stream-${Date.now()}`;
        streamingAssistantId.value = streamId;
        const next = [...messages.value];
        const index = next.findIndex((item) => item._streamId === streamId);
        if (index >= 0) {
          next[index] = {
            ...next[index],
            content: `${next[index].content || ""}${data.delta || ""}`,
            streaming: true,
          };
        } else {
          next.push({
            role: "assistant",
            content: data.delta || "",
            streaming: true,
            _streamId: streamId,
          });
        }
        messages.value = next;
      } else if (type === "tool_call") {
        finalizeStreamingAssistant();
        const args = parseToolArguments(data.toolCall?.function?.arguments);
        messages.value = [
          ...messages.value,
          {
            role: "assistant",
            type: "tool_call",
            title: data.toolCall?.function?.name || "tool",
            shell: data.toolCall?.function?.name === "shell",
            command: args?.command || "",
            detail: args ? JSON.stringify(args, null, 2) : "",
            expanded: true,
          },
        ];
      } else if (type === "tool_result") {
        const next = [...messages.value];
        let attached = false;
        for (let index = next.length - 1; index >= 0; index -= 1) {
          if (next[index].type === "tool_call" && !next[index].result) {
            next[index] = { ...next[index], result: data.message?.content || "" };
            attached = true;
            break;
          }
        }
        messages.value = attached
          ? next
          : [...next, { role: "assistant", type: "tool_result", content: data.message?.content || "" }];
      } else if (type === "usage") {
        sessionUsage.value = addUsage(sessionUsage.value, data.usage);
      } else if (type === "done") {
        finalizeStreamingAssistant();
        isLoading.value = false;
      } else if (type === "stopped") {
        finalizeStreamingAssistant();
        isLoading.value = false;
        closeStream();
      } else if (type === "end") {
        isLoading.value = false;
      } else if (type === "saved") {
        closeStream();
        void loadConversations(1);
      }
    },
    (error) => {
      closeStream();
      isLoading.value = false;
      messages.value = [
        ...messages.value,
        { role: "assistant", content: `请求失败：${error?.error || "连接中断"}` },
      ];
    },
    () => {
      wsStatus.value = "connected";
    }
  );

  try {
    await api.chat(activeConversationId.value, content.trim());
  } catch (error) {
    closeStream();
    isLoading.value = false;
    messages.value = [
      ...messages.value,
      { role: "assistant", content: `请求失败：${error.message}` },
    ];
  }
};

const stopMessage = async () => {
  if (!activeConversationId.value || !isLoading.value) return;
  try {
    await api.stopChat(activeConversationId.value);
  } catch {
    finalizeStreamingAssistant();
    closeStream();
    isLoading.value = false;
  }
};

watch(
  () => activeConversationId.value,
  async (conversationId) => {
    closeStream();
    messages.value = [];
    sessionUsage.value = { ...EMPTY_USAGE };
    olderPage.value = 1;
    hasOlderMessages.value = false;
    isLoadingOlder.value = false;
    isLoading.value = false;
    if (!conversationId) return;
    await Promise.all([
      loadLatestMessages(conversationId),
      loadConversationStats(conversationId),
    ]);
  },
  { immediate: true }
);

watch(
  () => route.fullPath,
  async () => {
    await loadConversations(conversationPage.value);
  }
);

onMounted(async () => {
  await Promise.all([loadConfig(), loadConversations(1)]);
  window.addEventListener("keydown", onShortcut);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onShortcut);
  closeStream();
});

const onShortcut = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchOpen.value = true;
  }
};
</script>
