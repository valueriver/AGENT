<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api.js";
import { formatTime, previewText, titleFromPrompt } from "../lib/messages.js";
import {
  layoutState,
  toggleTasksList,
  closeMobileTasksList,
} from "../state/layout.js";
import {
  taskState,
  setCurrentTask,
  clearCurrentTask,
} from "../state/task.js";
import { setCurrentConversation } from "../state/conversation.js";

const router = useRouter();

const tasks = ref([]);
const errorText = ref("");

const mode = ref("view");
const form = reactive({ name: "", detail: "" });

const selectedId = computed(() => taskState.currentId);
const selected = computed(() => taskState.current);

const refresh = async () => {
  errorText.value = "";
  try {
    const result = await api.listTasks();
    tasks.value = result.tasks || [];
    if (selectedId.value) {
      const fresh = tasks.value.find((t) => t.id === selectedId.value);
      if (fresh) setCurrentTask(fresh.id, fresh);
      else clearCurrentTask();
    }
  } catch (e) {
    errorText.value = e.message || "加载失败";
  }
};

const selectTask = (task) => {
  setCurrentTask(task.id, task);
  mode.value = "view";
  closeMobileTasksList();
};

const startCreate = () => {
  mode.value = "create";
  form.name = "";
  form.detail = "";
  clearCurrentTask();
  closeMobileTasksList();
};

const cancelCreate = () => {
  mode.value = "view";
  form.name = "";
  form.detail = "";
};

const submitCreate = async () => {
  const detail = form.detail.trim();
  if (!detail) return;
  const name = form.name.trim() || titleFromPrompt(detail);
  try {
    const res = await api.createTask({ name, detail });
    form.name = "";
    form.detail = "";
    mode.value = "view";
    await refresh();
    const newTask = tasks.value.find((t) => t.id === res.taskId);
    if (newTask) setCurrentTask(newTask.id, newTask);
  } catch (e) {
    errorText.value = e.message || "创建失败";
  }
};

const abort = async (id) => {
  try {
    await api.abortTask(id);
    await refresh();
  } catch (e) {
    errorText.value = e.message || "中止失败";
  }
};

const openConversation = (convId) => {
  if (!convId) return;
  setCurrentConversation(convId, null);
  router.push({ name: "chat" });
};

const statusBadgeClass = (status) => {
  if (status === "running" || status === "pending") return "badge-warning";
  if (status === "done" || status === "completed" || status === "success")
    return "badge-success";
  if (status === "aborted" || status === "cancelled") return "badge-neutral";
  if (status === "error" || status === "failed") return "badge-danger";
  return "";
};

onMounted(refresh);
</script>

<template>
  <div class="flex-1 min-h-0 min-w-0 flex relative">
    <!-- ── Desktop aside: task list ── -->
    <aside
      class="hidden md:flex flex-col min-h-0 overflow-hidden transition-[width] duration-300 ease-out shrink-0"
      :class="layoutState.tasksListCollapsed ? 'md:w-0' : 'md:w-[280px]'"
      style="background: linear-gradient(to right, var(--nav-from), var(--nav-to)), var(--color-bg);"
    >
      <div class="w-[280px] flex flex-col min-h-0 flex-1">
        <div class="flex items-center justify-between gap-2 p-3">
          <strong class="text-sm font-semibold text-text">任务</strong>
          <div class="flex items-center gap-1">
            <button
              class="btn btn-sm btn-ghost !px-2 !h-8 !w-8"
              title="刷新"
              @click="refresh"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
              </svg>
            </button>
          </div>
        </div>

        <div class="px-3 pb-2 shrink-0">
          <button
            class="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-border-soft bg-bg-raised text-text text-sm font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            @click="startCreate"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                 stroke-linejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新建任务
          </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
          <button
            v-for="task in tasks"
            :key="task.id"
            class="conv-item !py-2.5"
            :class="{ active: task.id === selectedId && mode === 'view' }"
            @click="selectTask(task)"
          >
            <div class="flex items-start justify-between gap-2 w-full">
              <div class="flex-1 min-w-0 text-sm font-medium truncate">
                <span class="font-mono text-xxs text-text-faint mr-1">
                  #{{ task.id }}
                </span>
                {{ task.name || "未命名" }}
              </div>
              <span
                class="badge shrink-0 !text-[10px] !py-0 !px-1.5"
                :class="statusBadgeClass(task.status)"
              >
                {{ task.status }}
              </span>
            </div>
            <div class="text-xs text-text-mute truncate w-full">
              {{ previewText(task.prompt, "暂无内容") }}
            </div>
            <div class="flex justify-between items-center gap-1.5 text-xxs text-text-faint mt-0.5 w-full">
              <span>会话 #{{ task.conversation_id }}</span>
              <span>{{ formatTime(task.created_at) }}</span>
            </div>
          </button>

          <div v-if="tasks.length === 0" class="empty mx-1 mt-2">
            <div class="text-text-dim font-medium">暂无任务</div>
            <div class="text-xxs text-text-faint">点击上方「新建任务」</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- ── Main detail ── -->
    <section class="flex-1 flex flex-col min-h-0 min-w-0">
      <!-- Create mode -->
      <template v-if="mode === 'create'">
        <div class="hidden md:flex items-center justify-between gap-3 py-3 px-5 shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <button
              class="btn btn-sm btn-ghost !px-2 !h-8 !w-8"
              :title="layoutState.tasksListCollapsed ? '显示任务列表' : '隐藏任务列表'"
              @click="toggleTasksList"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
              </svg>
            </button>
            <strong class="text-sm font-semibold text-text">新建任务</strong>
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto">
          <div class="mx-auto max-w-2xl px-5 py-8 flex flex-col gap-5">
            <p v-if="errorText" class="inline-error">{{ errorText }}</p>

            <header class="flex flex-col gap-1.5">
              <h2 class="m-0 text-2xl font-semibold text-text leading-tight">
                新建任务
              </h2>
              <p class="m-0 text-sm text-text-mute">
                以后台 Agent 的方式异步执行,完成后落到便签和会话里
              </p>
            </header>

            <div class="flex flex-col gap-4 p-5 rounded-2xl border border-border-soft bg-bg-raised">
              <div class="field">
                <label class="field-label">标题（可选）</label>
                <input
                  v-model="form.name"
                  class="input"
                  placeholder="留空则自动从内容截取"
                />
              </div>
              <div class="field">
                <label class="field-label">详情</label>
                <textarea
                  v-model="form.detail"
                  class="textarea"
                  rows="10"
                  placeholder="描述你希望 Agent 完成的事情…"
                />
                <span class="field-hint">提交后会创建一个新会话并开始执行</span>
              </div>
              <div class="flex items-center gap-2 justify-end">
                <button class="btn btn-sm btn-ghost" @click="cancelCreate">
                  取消
                </button>
                <button
                  class="btn btn-sm btn-primary"
                  :disabled="!form.detail.trim()"
                  @click="submitCreate"
                >
                  创建任务
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- View mode -->
      <template v-else-if="selected">
        <div class="hidden md:flex items-center justify-between gap-3 py-3 px-5 shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <button
              class="btn btn-sm btn-ghost !px-2 !h-8 !w-8"
              :title="layoutState.tasksListCollapsed ? '显示任务列表' : '隐藏任务列表'"
              @click="toggleTasksList"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
              </svg>
            </button>
            <strong class="text-sm font-semibold text-text truncate">
              <span class="font-mono text-xxs text-text-faint mr-1">
                #{{ selected.id }}
              </span>
              {{ selected.name || "未命名任务" }}
            </strong>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge" :class="statusBadgeClass(selected.status)">
              {{ selected.status }}
            </span>
            <button
              v-if="selected.status === 'pending' || selected.status === 'running'"
              class="btn btn-sm btn-danger"
              @click="abort(selected.id)"
            >
              中止
            </button>
            <button
              class="btn btn-sm btn-ghost"
              @click="openConversation(selected.conversation_id)"
            >
              查看会话
            </button>
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto">
          <div class="mx-auto max-w-3xl px-5 py-6 flex flex-col gap-5">
            <p v-if="errorText" class="inline-error">{{ errorText }}</p>

            <section class="flex flex-col gap-2">
              <h3 class="text-xxs font-semibold text-text-mute uppercase tracking-wider">
                Prompt
              </h3>
              <pre
                class="m-0 p-4 rounded-2xl bg-bg-raised border border-border-soft text-smd leading-relaxed whitespace-pre-wrap break-words"
                style="font-family: var(--font-sans);"
              >{{ selected.prompt || "(空)" }}</pre>
            </section>

            <section v-if="selected.response" class="flex flex-col gap-2">
              <h3 class="text-xxs font-semibold text-text-mute uppercase tracking-wider">
                Response
              </h3>
              <pre
                class="m-0 p-4 rounded-2xl bg-bg-raised border border-border-soft text-smd leading-relaxed whitespace-pre-wrap break-words"
                style="font-family: var(--font-sans);"
              >{{ selected.response }}</pre>
            </section>

            <section v-if="selected.error" class="flex flex-col gap-2">
              <h3 class="text-xxs font-semibold text-danger uppercase tracking-wider">
                Error
              </h3>
              <pre
                class="m-0 p-4 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-danger"
                style="background: color-mix(in oklab, var(--color-danger) 8%, transparent);
                       border: 1px solid color-mix(in oklab, var(--color-danger) 25%, transparent);"
              >{{ selected.error }}</pre>
            </section>

            <section class="flex flex-col gap-2">
              <h3 class="text-xxs font-semibold text-text-mute uppercase tracking-wider">
                元数据
              </h3>
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs text-text-dim p-4 rounded-2xl border border-border-soft bg-bg-raised">
                <dt class="text-text-mute">任务 ID</dt>
                <dd class="font-mono">#{{ selected.id }}</dd>
                <dt class="text-text-mute">会话 ID</dt>
                <dd class="font-mono">
                  <button
                    class="text-accent hover:underline"
                    @click="openConversation(selected.conversation_id)"
                  >
                    #{{ selected.conversation_id }}
                  </button>
                </dd>
                <dt class="text-text-mute">状态</dt>
                <dd>{{ selected.status }}</dd>
                <dt class="text-text-mute">创建</dt>
                <dd>{{ formatTime(selected.created_at) }}</dd>
                <dt v-if="selected.finished_at" class="text-text-mute">完成</dt>
                <dd v-if="selected.finished_at">
                  {{ formatTime(selected.finished_at) }}
                </dd>
              </dl>
            </section>
          </div>
        </div>
      </template>

      <!-- Empty: no selection -->
      <template v-else>
        <div class="hidden md:flex items-center gap-2 py-3 px-5 shrink-0">
          <button
            class="btn btn-sm btn-ghost !px-2 !h-8 !w-8"
            :title="layoutState.tasksListCollapsed ? '显示任务列表' : '隐藏任务列表'"
            @click="toggleTasksList"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <strong class="text-sm font-semibold text-text">任务</strong>
          <span class="text-xs text-text-mute">{{ tasks.length }} 条</span>
        </div>

        <div class="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p v-if="errorText" class="inline-error">{{ errorText }}</p>
          <div
            class="w-14 h-14 rounded-2xl grid place-items-center text-text-faint"
            style="background: var(--color-bg-raised); border: 1px solid var(--color-border-soft);"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                 stroke-linejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div class="flex flex-col gap-1">
            <div class="text-text font-medium">选择一个任务查看详情</div>
            <div class="text-xs text-text-mute max-w-[280px]">
              从左侧列表选择,或
              <button class="text-accent hover:underline" @click="startCreate">
                新建任务
              </button>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- ── Mobile bottom sheet ── -->
    <div
      v-if="layoutState.mobileTasksListOpen"
      class="md:hidden fixed inset-0 z-50 flex flex-col"
    >
      <div class="flex-1 bg-black/60 backdrop-blur-sm" @click="closeMobileTasksList"></div>
      <div
        class="bg-bg-raised rounded-t-3xl flex flex-col max-h-[85vh] min-h-[60vh] shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
      >
        <div class="flex justify-center pt-2.5 pb-1 shrink-0">
          <div class="w-10 h-1 rounded-full bg-border-strong"></div>
        </div>

        <div class="flex flex-col gap-2.5 p-3 shrink-0">
          <button
            class="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-border-soft bg-bg text-text text-sm font-semibold"
            @click="startCreate"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                 stroke-linejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新建任务
          </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-0.5">
          <button
            v-for="task in tasks"
            :key="task.id"
            class="conv-item"
            :class="{ active: task.id === selectedId }"
            @click="selectTask(task)"
          >
            <div class="flex items-start justify-between gap-2 w-full">
              <div class="flex-1 min-w-0 text-sm font-medium truncate">
                <span class="font-mono text-xxs text-text-faint mr-1">
                  #{{ task.id }}
                </span>
                {{ task.name || "未命名" }}
              </div>
              <span
                class="badge shrink-0 !text-[10px] !py-0 !px-1.5"
                :class="statusBadgeClass(task.status)"
              >
                {{ task.status }}
              </span>
            </div>
            <div class="text-xs text-text-mute truncate w-full">
              {{ previewText(task.prompt, "暂无内容") }}
            </div>
          </button>

          <div v-if="tasks.length === 0" class="empty mx-1">
            <div class="text-text-dim font-medium">暂无任务</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
