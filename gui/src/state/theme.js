import { reactive, watch } from "vue";

const STORAGE_KEY = "theme.mode";
const THEMES = new Set(["dark", "light"]);

const readTheme = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.has(value) ? value : "dark";
  } catch {
    return "dark";
  }
};

const applyTheme = (theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
};

export const themeState = reactive({
  mode: readTheme(),
});

export const setTheme = (theme) => {
  themeState.mode = THEMES.has(theme) ? theme : "dark";
};

export const toggleTheme = () => {
  setTheme(themeState.mode === "dark" ? "light" : "dark");
};

export const initTheme = () => {
  applyTheme(themeState.mode);
};

watch(
  () => themeState.mode,
  (mode) => {
    applyTheme(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  },
  { immediate: true }
);
