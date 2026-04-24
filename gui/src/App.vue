<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  layoutState,
  toggleMainNav,
  openMobileNav,
  closeMobileNav,
  openMobileChatList,
  openMobileTasksList,
} from "./state/layout.js";
import { conversationState } from "./state/conversation.js";
import { taskState } from "./state/task.js";
import { themeState, toggleTheme } from "./state/theme.js";

const navItems = [
  { name: "chat", label: "聊天", icon: "chat" },
  { name: "tasks", label: "任务", icon: "tasks" },
  { name: "memos", label: "便签", icon: "memos" },
  { name: "memories", label: "记忆", icon: "memories" },
  { name: "settings", label: "设置", icon: "settings" },
];

const route = useRoute();

const currentNav = computed(
  () => navItems.find((n) => n.name === route.name) || null,
);

const mobileTitle = computed(() => {
  if (route.name === "chat") {
    return conversationState.current?.title || "新会话";
  }
  if (route.name === "tasks") {
    return taskState.current?.name || "任务";
  }
  return currentNav.value?.label || "";
});

const mobileSubTitle = computed(() => {
  if (route.name === "chat" && conversationState.current) {
    return `#${conversationState.current.id}`;
  }
  if (route.name === "tasks" && taskState.current) {
    return `#${taskState.current.id}`;
  }
  return "";
});

const hasMobileSheet = computed(
  () => route.name === "chat" || route.name === "tasks",
);

const openCurrentMobileSheet = () => {
  if (route.name === "chat") openMobileChatList();
  else if (route.name === "tasks") openMobileTasksList();
};

const collapsed = computed(() => layoutState.mainNavCollapsed);
const themeLabel = computed(() =>
  themeState.mode === "dark" ? "切换到浅色主题" : "切换到深色主题",
);
</script>

<template>
  <div class="h-screen flex flex-col md:flex-row bg-bg">
    <!-- Mobile top bar -->
    <header
      class="md:hidden h-12 shrink-0 flex items-center gap-2 px-2 border-b border-border-soft bg-bg-raised"
    >
      <button
        class="btn btn-sm btn-ghost !px-2"
        title="打开菜单"
        @click="openMobileNav"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <button
        v-if="hasMobileSheet"
        class="flex-1 min-w-0 flex items-center justify-center gap-1 text-sm font-semibold text-text truncate bg-transparent border-0"
        @click="openCurrentMobileSheet"
      >
        <span class="truncate">{{ mobileTitle }}</span>
        <span v-if="mobileSubTitle" class="text-text-mute font-normal">
          {{ mobileSubTitle }}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0 text-text-mute"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        v-else
        class="flex-1 min-w-0 text-center text-sm font-semibold text-text truncate"
      >
        {{ mobileTitle }}
      </div>

      <button
        class="btn btn-sm btn-ghost !px-2"
        :title="themeLabel"
        @click="toggleTheme"
      >
        <svg
          v-if="themeState.mode === 'dark'"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3a6 6 0 1 0 9 9 9 9 0 1 1-9-9z" />
        </svg>
      </button>
    </header>

    <!-- Main nav sidebar -->
    <aside
      class="bg-bg-raised border-border-soft flex flex-col shrink-0 transition-[width,transform] duration-200 ease-out
        max-md:fixed max-md:top-0 max-md:left-0 max-md:bottom-0 max-md:w-[260px] max-md:z-50 max-md:border-r
        md:static md:border-r"
      :class="[
        layoutState.mobileNavOpen
          ? 'max-md:translate-x-0'
          : 'max-md:-translate-x-full',
        collapsed ? 'md:w-[56px]' : 'md:w-[220px]',
      ]"
    >
      <div
        class="flex items-center gap-2.5 pt-3 pb-3.5 overflow-hidden"
        :class="collapsed ? 'md:px-2 md:justify-center' : 'px-4'"
      >
        <div
          class="w-[26px] h-[26px] rounded-lg grid place-items-center text-white font-bold text-[12px] tracking-wider shrink-0"
          style="
            background: linear-gradient(135deg, #7c8cff 0%, #a855f7 100%);
            box-shadow: 0 4px 14px rgba(124, 140, 255, 0.35);
          "
        >
          A
        </div>
        <div v-if="!collapsed" class="flex flex-col leading-tight min-w-0">
          <strong
            class="text-[13px] font-semibold tracking-wide text-text truncate"
          >
            AGENT
          </strong>
          <span class="text-xxs text-text-mute truncate">本地控制台</span>
        </div>
        <button
          class="md:hidden btn btn-sm btn-ghost ml-auto !px-2"
          title="关闭"
          @click="closeMobileNav"
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

      <div class="flex flex-col gap-0.5 px-2 flex-1 min-h-0 overflow-hidden">
        <div
          v-if="!collapsed"
          class="text-[10.5px] uppercase tracking-wider text-text-faint px-3 pt-1 pb-1.5"
        >
          工作区
        </div>
        <router-link
          v-for="item in navItems"
          :key="item.name"
          v-slot="{ isActive, navigate }"
          :to="{ name: item.name }"
          custom
        >
          <button
            class="nav-item"
            :class="[
              { active: isActive },
              collapsed ? 'md:justify-center md:px-0' : '',
            ]"
            :title="collapsed ? item.label : ''"
            @click="
              navigate();
              closeMobileNav();
            "
          >
            <span
              class="w-4 h-4 grid place-items-center shrink-0 opacity-90"
              aria-hidden="true"
            >
              <svg
                v-if="item.icon === 'chat'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'tasks'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 11l3 3L22 4" />
                <path
                  d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'memos'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
                />
                <path d="M14 3v6h6" />
                <path d="M8 13h8M8 17h5" />
              </svg>
              <svg
                v-else-if="item.icon === 'memories'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12 2l2.4 5 5.6.8-4 4 1 5.6L12 14.8 6.9 17.4 8 11.8 4 7.8l5.6-.8z"
                />
              </svg>
              <svg
                v-else
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
                />
              </svg>
            </span>
            <span
              v-if="!collapsed"
              class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ item.label }}
            </span>
          </button>
        </router-link>
      </div>

      <!-- Desktop collapse toggle -->
      <div
        class="hidden md:flex border-t border-border-soft px-2 py-2 gap-1"
        :class="collapsed ? 'justify-center' : 'justify-between'"
      >
        <button
          class="btn btn-sm btn-ghost !px-2"
          :title="themeLabel"
          @click="toggleTheme"
        >
          <svg
            v-if="themeState.mode === 'dark'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            />
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3a6 6 0 1 0 9 9 9 9 0 1 1-9-9z" />
          </svg>
        </button>
        <button
          class="btn btn-sm btn-ghost !px-2"
          :title="collapsed ? '展开导航' : '收起导航'"
          @click="toggleMainNav"
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
            class="transition-transform"
            :class="collapsed ? '' : 'rotate-180'"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </aside>

    <!-- Mobile backdrop for main nav -->
    <div
      v-if="layoutState.mobileNavOpen"
      class="md:hidden fixed inset-0 bg-black/50 z-40"
      @click="closeMobileNav"
    />

    <main class="flex-1 flex flex-col min-w-0 min-h-0 bg-bg">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
  </div>
</template>
