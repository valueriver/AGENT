<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(37,24,15,0.35)] p-4 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="w-full max-w-xl rounded-[28px] border border-[rgba(160,120,80,0.18)] bg-[#fffaf4] p-6 shadow-[0_30px_80px_rgba(92,67,50,0.18)]">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[11px] uppercase tracking-[0.28em] text-[rgba(92,67,50,0.45)]">Settings</div>
          <h2 class="mt-1 text-xl font-semibold text-[#2a1f13]">模型配置</h2>
        </div>
        <button type="button" class="rounded-xl p-2 text-[rgba(0,0,0,0.4)] transition hover:bg-[rgba(160,120,80,0.08)]" @click="$emit('close')">
          <X class="h-5 w-5" />
        </button>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-[#3d2f1e]">API URL</span>
          <input v-model.trim="form.apiUrl" required type="text" class="w-full rounded-2xl border border-[rgba(160,120,80,0.2)] bg-white px-4 py-3 text-sm text-[#2a1f13] outline-none transition focus:border-[rgba(92,67,50,0.45)]" placeholder="https://api.openai.com/v1/chat/completions" />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-[#3d2f1e]">API Key</span>
          <input v-model.trim="form.apiKey" required type="password" class="w-full rounded-2xl border border-[rgba(160,120,80,0.2)] bg-white px-4 py-3 text-sm text-[#2a1f13] outline-none transition focus:border-[rgba(92,67,50,0.45)]" placeholder="sk-..." />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-[#3d2f1e]">Model</span>
          <input v-model.trim="form.model" required type="text" class="w-full rounded-2xl border border-[rgba(160,120,80,0.2)] bg-white px-4 py-3 text-sm text-[#2a1f13] outline-none transition focus:border-[rgba(92,67,50,0.45)]" placeholder="gpt-5.4" />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-[#3d2f1e]">上下文轮数</span>
          <input v-model.number="form.contextTurns" min="0" step="1" type="number" class="w-full rounded-2xl border border-[rgba(160,120,80,0.2)] bg-white px-4 py-3 text-sm text-[#2a1f13] outline-none transition focus:border-[rgba(92,67,50,0.45)]" />
        </label>

        <div class="rounded-2xl bg-[rgba(160,120,80,0.06)] px-4 py-3 text-xs leading-5 text-[rgba(0,0,0,0.5)]">
          填好后保存即可，后续对话会使用这里的配置。
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" class="rounded-2xl px-4 py-2.5 text-sm text-[rgba(0,0,0,0.45)] transition hover:bg-[rgba(160,120,80,0.08)]" @click="$emit('close')">取消</button>
          <button type="submit" class="rounded-2xl bg-[#5c4332] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(92,67,50,0.18)] transition hover:opacity-90">保存</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps({
  open: { type: Boolean, default: false },
  currentConfig: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["close", "save"]);

const form = reactive({
  apiUrl: "",
  apiKey: "",
  model: "",
  contextTurns: 10,
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.apiUrl = props.currentConfig?.apiUrl || "";
    form.apiKey = props.currentConfig?.apiKey || "";
    form.model = props.currentConfig?.model || "";
    form.contextTurns = Number.isInteger(Number(props.currentConfig?.contextTurns))
      ? Math.max(0, Number(props.currentConfig.contextTurns))
      : 10;
  },
  { immediate: true }
);

const submit = () => {
  emit("save", {
    apiUrl: form.apiUrl,
    apiKey: form.apiKey,
    model: form.model,
    contextTurns: Math.max(0, Number.parseInt(form.contextTurns, 10) || 0),
  });
};
</script>
