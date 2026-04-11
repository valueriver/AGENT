import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:9503",
      "/chat": "http://127.0.0.1:9503",
      "/base/stream": "http://127.0.0.1:9503",
      "/task": "http://127.0.0.1:9503",
      "/health": "http://127.0.0.1:9503",
    },
  },
});
