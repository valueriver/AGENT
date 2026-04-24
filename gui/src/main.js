import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router/index.js";
import { initTheme } from "./state/theme.js";
import "./styles.css";

initTheme();
createApp(App).use(router).mount("#app");
