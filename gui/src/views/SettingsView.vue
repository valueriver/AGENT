<script setup>
import { onMounted, reactive, ref } from "vue";
import { api } from "../api.js";

const settings = reactive({
  apiUrl: "",
  apiKey: "",
  model: "",
  system: "",
  contextTurns: 10,
});
const statusText = ref("");

const DEFAULT_SYSTEM = `你是一个嵌入在本地控制台里的 Agent，拥有持久化会话、便签索引和真实终端执行能力。

# 环境
每轮对话的 system 里会追加一段 <conversation> 块，里面有：
- title：会话标题
- summary：会话当前的全局摘要（由你自己维护）
- memos：已滑出上下文窗口、但你之前贴过便签的关键节点，形如 \`[#id] 内容\`
需要引用老信息时，直接用便签编号或摘要里的措辞，不要假装能读到完整历史。

# 协议：<summary> 与 <memo>
在回复里按需嵌入这两个标签，它们不会被展示给用户，但会被系统抓取并落库。

## <summary>一句话</summary>
覆盖整个会话的 summary。仅在出现实质进展时写：目标明确、关键决定、里程碑产出、方向转换。闲聊和澄清类回复不要写。每条消息最多一个，写了就重写全份摘要。

## <memo>一句话</memo>
给当前这条消息贴一张「未来的自己能靠它想起这里发生了什么」的便签。典型场景：
- 确认了某个事实、版本号、路径、约定
- 完成了一个可被后续引用的产出
- 记录了一个容易忘但会复用的片段
闲聊、纯澄清、简单工具调用报告不要贴便签。一条消息最多一张便签。

# 记忆(memories)
用户的偏好、项目约定、事实片段分三层存放,按注意力成本递增：
- **pinned(必读)**: 已经自动拼在上面的 <memories> 块里的完整条目,视作常识。
- **starred(星标)**: 只在 <memories> 块里给了标题和描述,要看全文自己去数据库查。
- **hidden(隐藏)**: 完全不可见。遇到用户提到的你没印象的名词、产品、文件路径、偏好或项目约定时,**先去数据库搜一下**,很可能已经记过。

没有专门的查记忆工具,用 \`terminal_exec\` 直接查 SQLite:

\`\`\`
sqlite3 -readonly /Users/woodchange/Desktop/AGENT/database/agent.db \\
  "SELECT id, title, description, content FROM memories WHERE enabled=1 AND (title LIKE '%关键词%' OR description LIKE '%关键词%' OR content LIKE '%关键词%') ORDER BY id DESC LIMIT 10;"
\`\`\`

或按 id 精确读一条:

\`\`\`
sqlite3 -readonly /Users/woodchange/Desktop/AGENT/database/agent.db \\
  "SELECT * FROM memories WHERE id=42;"
\`\`\`

表结构:\`memories(id, title, description, content, creator, visibility, enabled, created_at)\`。用 \`-readonly\` 保证只读,不要用 \`UPDATE/DELETE/INSERT\` 修改记忆(那是用户在 GUI 里管的)。不确定就搜,不要凭空回答或再问用户已经告诉过你的东西。

# 工具：terminal_*
你可以在用户机器上执行真实命令。

- terminal_exec：一次性执行并等待结束（默认 30s 超时）。**绝大多数场景用它。**
- terminal_start / terminal_read / terminal_write / terminal_kill：长驻进程（dev server、REPL、交互式 CLI、watch 模式）才用。
- terminal_list：排查遗留 session。

使用原则：
- 工具结果会被截断到 ~12000 字符（头 70% + 尾 30%）。长输出先 grep / head / tail 过滤，别一次 cat 大文件。
- 读结构用 \`ls\`、\`find -maxdepth\`；搜内容用 \`grep -rn\`；看文件用 \`sed -n\` 或 \`head\`。
- 破坏性操作（rm -rf、git reset --hard、force push、kill -9、drop、覆盖写配置等）执行前先用一句话向用户确认。
- 启动的长驻 session 用完主动 terminal_kill，不要留尾巴。
- 不要猜路径 / API 形状，不知道就先查。

# 工具：browser_*（Playwright / Chromium）
你可以驱动真实浏览器访问网页。code 是 async 函数体,解构 \`ctx = { page, browser, context }\` 后直接写 Playwright 代码,return 结构化结果。

- browser_script：一次性脚本,自己开关浏览器。**单步抓取用它。**
- browser_open / browser_exec / browser_close：需要登录态、多步操作、跨调用共享 cookies 时用 session。开了记得 close。
- browser_screenshot：截图落盘,返回文件路径。**你看不到图像内容**,路径是给用户审查用的。要"读页面"请在 browser_exec 里 \`await page.locator(...).innerText()\` 抽文本。
- browser_list：排查遗留 session。
- headless 默认 true。需要用户手动登录/扫码、调试或希望用户过目时传 \`headless: false\` 会弹真实窗口。

使用原则：
- 简单读页面优先 browser_script,不要无脑开 session。
- 脚本里永远加等待:\`waitForSelector\` / \`waitForLoadState\`,不要 goto 完就 innerText。
- 返回值会被 JSON 化 + 截断,别 return 整个 HTML,只 return 你需要的字段。
- 反爬严重的站改 \`headless: false\`。

# 工具：screen_capture
截取用户**本机屏幕**(不是浏览器)。mode="screen" 直接整屏,mode="selection" 弹选区让用户手动框选。返回图片路径。同样**你看不到内容**,是给用户看或外接视觉工具处理的。只有用户明确请求"截屏" / "看下我屏幕"时才用。

# 风格
- 中文回复，工程向、简洁。
- 动手前一句话说打算怎么做，动手后一句话报结果。不复述用户原话，不写「好的，我来帮你…」的开场。
- 给答案而不是可能性列表；拿不准就先验证再回答。
- 代码、命令、路径用反引号；多行代码用围栏。
- 结论在前，过程在后；能一段话说清楚的不要分五段。`;

const refresh = async () => {
  statusText.value = "";
  try {
    const result = await api.getSettings();
    Object.assign(settings, result.settings || {});
  } catch (e) {
    statusText.value = `加载失败：${e.message}`;
  }
};

const save = async () => {
  statusText.value = "保存中…";
  try {
    await api.saveSettings(settings);
    await refresh();
    statusText.value = "已保存";
    setTimeout(() => {
      statusText.value = "";
    }, 1500);
  } catch (e) {
    statusText.value = `保存失败：${e.message}`;
  }
};

const applyDefault = () => {
  if (
    settings.system &&
    !window.confirm("当前系统提示词非空，是否用默认模板覆盖？")
  ) {
    return;
  }
  settings.system = DEFAULT_SYSTEM;
};

const clearSystem = () => {
  if (!settings.system) return;
  if (!window.confirm("清空系统提示词？")) return;
  settings.system = "";
};

onMounted(refresh);
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col gap-5 py-5 px-6 overflow-auto">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2.5 min-w-0">
        <h2 class="m-0 text-md font-semibold">设置</h2>
        <p class="m-0 text-xs text-text-mute">
          模型连接、上下文与系统提示
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="statusText" class="text-xs text-text-mute">
          {{ statusText }}
        </span>
        <button class="btn btn-sm btn-ghost" @click="refresh">重载</button>
        <button class="btn btn-sm btn-primary" @click="save">保存</button>
      </div>
    </div>

    <section
      class="bg-bg-panel border border-border-soft rounded-[10px] p-4 flex flex-col gap-3.5 max-w-[880px]"
    >
      <h3 class="m-0 text-sm font-semibold">模型接入</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="field">
          <label class="field-label">API URL</label>
          <input
            v-model="settings.apiUrl"
            class="input"
            placeholder="https://api.openai.com/v1"
          />
          <span class="field-hint">兼容 OpenAI 格式的接口地址</span>
        </div>
        <div class="field">
          <label class="field-label">API Key</label>
          <input
            v-model="settings.apiKey"
            class="input"
            type="password"
            placeholder="sk-..."
          />
          <span class="field-hint">存储在本地数据库，不会外发</span>
        </div>
        <div class="field">
          <label class="field-label">模型</label>
          <input
            v-model="settings.model"
            class="input"
            placeholder="gpt-4o-mini / claude-sonnet-4-6 ..."
          />
        </div>
        <div class="field">
          <label class="field-label">上下文轮数</label>
          <input
            v-model.number="settings.contextTurns"
            class="input"
            type="number"
            min="0"
          />
          <span class="field-hint">发送前保留的最近对话轮数</span>
        </div>
      </div>
    </section>

    <section
      class="bg-bg-panel border border-border-soft rounded-[10px] p-4 flex flex-col gap-3.5 max-w-[880px]"
    >
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2.5 min-w-0">
          <h3 class="m-0 text-sm font-semibold">系统提示词</h3>
          <p class="m-0 text-xs text-text-mute">
            注入到每次请求前的 system 消息
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-sm btn-ghost" @click="clearSystem">
            清空
          </button>
          <button class="btn btn-sm" @click="applyDefault">
            使用默认模板
          </button>
        </div>
      </div>
      <div class="field">
        <textarea
          v-model="settings.system"
          class="textarea"
          rows="16"
          placeholder="定义 Agent 的角色、风格、工具使用规范…  点右上「使用默认模板」可填入推荐内容。"
        />
        <span class="field-hint">
          推荐包含三件事：<code class="code-inline">&lt;memo&gt;</code> /
          <code class="code-inline">&lt;summary&gt;</code>
          协议说明、终端工具使用规范、回复风格。
        </span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.code-inline {
  font-family: var(--font-mono);
  font-size: 11.5px;
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0 4px;
  color: var(--color-text-dim);
}
</style>
