import { createRouter, createWebHistory } from "vue-router";
import WorkspaceView from "./views/WorkspaceView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: WorkspaceView },
    { path: "/conversation/:conversationId", component: WorkspaceView, props: true },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
