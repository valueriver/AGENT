import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  { path: "/", redirect: "/chat" },
  {
    path: "/chat",
    name: "chat",
    component: () => import("../views/ChatView.vue"),
  },
  {
    path: "/tasks",
    name: "tasks",
    component: () => import("../views/TasksView.vue"),
  },
  {
    path: "/memos",
    name: "memos",
    component: () => import("../views/MemosView.vue"),
  },
  {
    path: "/memories",
    name: "memories",
    component: () => import("../views/MemoriesView.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../views/SettingsView.vue"),
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
