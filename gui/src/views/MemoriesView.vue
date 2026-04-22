<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../api.js";
import { previewText } from "../lib/messages.js";

const memories = ref([]);
const newMemory = reactive({
  title: "",
  description: "",
  content: "",
  visibility: "hidden",
});
const errorText = ref("");

const VISIBILITY_ORDER = ["hidden", "starred", "pinned"];
const VISIBILITY_META = {
  hidden: { label: "隐藏", hint: "模型不可见,可通过 search 查到", badge: "badge-neutral" },
  starred: { label: "星标", hint: "标题+描述进 system,模型可 memory_get", badge: "badge-warning" },
  pinned: { label: "必读", hint: "完整内容直接拼进 system", badge: "badge-success" },
};

const counts = computed(() => {
  const c = { hidden: 0, starred: 0, pinned: 0, total: memories.value.length };
  for (const m of memories.value) {
    if (c[m.visibility] !== undefined) c[m.visibility] += 1;
  }
  return c;
});

const refresh = async () => {
  errorText.value = "";
  try {
    const result = await api.listMemories();
    memories.value = result.memories || [];
  } catch (e) {
    errorText.value = e.message || "加载失败";
  }
};

const submit = async () => {
  if (!newMemory.title.trim() || !newMemory.content.trim()) return;
  try {
    await api.createMemory({
      title: newMemory.title,
      description: newMemory.description,
      content: newMemory.content,
      visibility: newMemory.visibility || "hidden",
    });
    newMemory.title = "";
    newMemory.description = "";
    newMemory.content = "";
    newMemory.visibility = "hidden";
    await refresh();
  } catch (e) {
    errorText.value = e.message || "创建失败";
  }
};

const setVisibility = async (memory, visibility) => {
  if (memory.visibility === visibility) return;
  try {
    await api.updateMemory(memory.id, { visibility });
    await refresh();
  } catch (e) {
    errorText.value = e.message || "更新失败";
  }
};

const toggleEnabled = async (memory) => {
  try {
    await api.updateMemory(memory.id, { enabled: !memory.enabled });
    await refresh();
  } catch (e) {
    errorText.value = e.message || "更新失败";
  }
};

const remove = async (id) => {
  if (!window.confirm("删除此记忆？")) return;
  try {
    await api.deleteMemory(id);
    await refresh();
  } catch (e) {
    errorText.value = e.message || "删除失败";
  }
};

onMounted(refresh);
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col gap-3.5 py-5 px-6 overflow-auto">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2.5 min-w-0">
        <h2 class="m-0 text-md font-semibold">记忆</h2>
        <p class="m-0 text-xs text-text-mute">
          跨会话沉淀 · 共 {{ counts.total }} 条 · 必读
          {{ counts.pinned }} · 星标 {{ counts.starred }} · 隐藏
          {{ counts.hidden }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-sm btn-ghost" @click="refresh">刷新</button>
      </div>
    </div>

    <p v-if="errorText" class="inline-error">{{ errorText }}</p>

    <div class="form-card">
      <div class="field">
        <label class="field-label">标题</label>
        <input
          v-model="newMemory.title"
          class="input"
          placeholder="例如：产品偏好"
        />
      </div>
      <div class="field">
        <label class="field-label">描述（可选）</label>
        <input
          v-model="newMemory.description"
          class="input"
          placeholder="一句话说明何时触发"
        />
      </div>
      <div class="field col-span-full">
        <label class="field-label">内容</label>
        <textarea
          v-model="newMemory.content"
          class="textarea"
          rows="4"
          placeholder="记下具体事实、偏好或规则…"
        />
      </div>
      <div class="field col-span-full">
        <label class="field-label">可见性</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="v in VISIBILITY_ORDER"
            :key="v"
            type="button"
            class="btn btn-sm"
            :class="newMemory.visibility === v ? 'btn-primary' : 'btn-ghost'"
            @click="newMemory.visibility = v"
          >
            {{ VISIBILITY_META[v].label }}
          </button>
        </div>
        <span class="field-hint">
          {{ VISIBILITY_META[newMemory.visibility]?.hint }}
        </span>
      </div>
      <div class="col-span-full flex justify-end gap-2">
        <button
          class="btn btn-sm btn-primary"
          :disabled="!newMemory.title.trim() || !newMemory.content.trim()"
          @click="submit"
        >
          保存记忆
        </button>
      </div>
    </div>

    <div class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
      <article
        v-for="memory in memories"
        :key="memory.id"
        class="item-card"
        :class="{ 'opacity-55': !memory.enabled }"
      >
        <div class="flex items-start justify-between gap-2.5">
          <div class="text-sm font-semibold leading-snug break-words">
            {{ memory.title }}
          </div>
          <span
            class="badge"
            :class="VISIBILITY_META[memory.visibility]?.badge || 'badge-neutral'"
          >
            {{ VISIBILITY_META[memory.visibility]?.label || memory.visibility }}
          </span>
        </div>
        <div
          v-if="memory.description"
          class="text-xs text-text-mute break-words"
        >
          {{ memory.description }}
        </div>
        <div class="text-xs text-text-dim leading-relaxed break-words">
          {{ previewText(memory.content) }}
        </div>

        <div class="flex flex-col gap-1.5 mt-0.5">
          <span class="text-xxs text-text-faint">可见性</span>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="v in VISIBILITY_ORDER"
              :key="v"
              type="button"
              class="btn btn-sm"
              :class="memory.visibility === v ? 'btn-primary' : 'btn-ghost'"
              @click="setVisibility(memory, v)"
            >
              {{ VISIBILITY_META[v].label }}
            </button>
          </div>
        </div>

        <div class="flex gap-1.5 mt-0.5">
          <button class="btn btn-sm" @click="toggleEnabled(memory)">
            {{ memory.enabled ? "停用" : "启用" }}
          </button>
          <button class="btn btn-sm btn-danger" @click="remove(memory.id)">
            删除
          </button>
        </div>
      </article>
    </div>

    <div v-if="memories.length === 0" class="empty">
      <div class="text-text-dim font-medium">暂无记忆</div>
      <div class="text-xs text-text-faint">在上方表单创建第一条</div>
    </div>
  </div>
</template>
