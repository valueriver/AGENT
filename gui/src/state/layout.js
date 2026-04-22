import { reactive, watch } from "vue";

const loadBool = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "1";
  } catch {
    return fallback;
  }
};

const saveBool = (key, value) => {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
};

export const layoutState = reactive({
  // 桌面端折叠状态(持久化)
  mainNavCollapsed: loadBool("layout.mainNav", false),
  chatListCollapsed: loadBool("layout.chatList", false),
  tasksListCollapsed: loadBool("layout.tasksList", false),
  // 移动端瞬时打开状态(不持久化)
  mobileNavOpen: false,
  mobileChatListOpen: false,
  mobileTasksListOpen: false,
});

watch(
  () => layoutState.mainNavCollapsed,
  (v) => saveBool("layout.mainNav", v),
);
watch(
  () => layoutState.chatListCollapsed,
  (v) => saveBool("layout.chatList", v),
);
watch(
  () => layoutState.tasksListCollapsed,
  (v) => saveBool("layout.tasksList", v),
);

export const toggleMainNav = () => {
  layoutState.mainNavCollapsed = !layoutState.mainNavCollapsed;
};
export const toggleChatList = () => {
  layoutState.chatListCollapsed = !layoutState.chatListCollapsed;
};
export const toggleTasksList = () => {
  layoutState.tasksListCollapsed = !layoutState.tasksListCollapsed;
};

export const openMobileNav = () => {
  layoutState.mobileNavOpen = true;
  layoutState.mobileChatListOpen = false;
  layoutState.mobileTasksListOpen = false;
};
export const closeMobileNav = () => {
  layoutState.mobileNavOpen = false;
};
export const openMobileChatList = () => {
  layoutState.mobileChatListOpen = true;
  layoutState.mobileNavOpen = false;
  layoutState.mobileTasksListOpen = false;
};
export const closeMobileChatList = () => {
  layoutState.mobileChatListOpen = false;
};
export const openMobileTasksList = () => {
  layoutState.mobileTasksListOpen = true;
  layoutState.mobileNavOpen = false;
  layoutState.mobileChatListOpen = false;
};
export const closeMobileTasksList = () => {
  layoutState.mobileTasksListOpen = false;
};
