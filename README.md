# agent

从 `AIOS/server/agent` 提取出的独立 CLI。

## 用法

先在 [llm.js](/Users/woodchange/Desktop/projects/agent/llm.js) 顶部填写模型配置：

```js
const llmConfig = {
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiKey: "your_key",
  model: "gpt-4.1-mini"
};
```

如果 [llm.js](/Users/woodchange/Desktop/projects/agent/llm.js) 顶部某个值留空，会自动回退到环境变量：

```bash
export OPENAI_API_KEY=your_key
export AGENT_MODEL=gpt-4.1-mini
```

先启动服务：

```bash
node server/index.js
```

再进入交互模式：

```bash
node cli.js
```

这会新建一个 base 目录：

```bash
bases/1/
bases/2/
...
```

单次执行：

```bash
node cli.js "帮我看看当前目录"
```

加载最新 base：

```bash
node cli.js -1
```

加载指定 base：

```bash
node cli.js 3
```

也可以显式传参：

```bash
node cli.js \
  --server http://127.0.0.1:9503 \
  --api-url https://api.openai.com/v1/chat/completions \
  --api-key "$OPENAI_API_KEY" \
  --model "$AGENT_MODEL"
```

## 环境变量

- 优先级：命令行参数 > `llm.js` 顶部已填写的值 > 环境变量
- `AGENT_SERVER_URL`，默认 `http://127.0.0.1:9503`
- `AGENT_API_URL`，默认 `https://api.openai.com/v1/chat/completions`
- `AGENT_API_KEY`，也兼容 `OPENAI_API_KEY`
- `AGENT_MODEL`

## 能力

当前只保留一个工具：

- `shell`：执行 shell 命令并返回输出

## Base 历史

- base 保存在 [bases](/Users/woodchange/Desktop/projects/agent/bases) 目录
- 每个 base 一个数字目录，按 `1`、`2`、`3` 递增
- `messages.json` 由 `9503` 服务读写
- `node cli.js -1` 会加载最新一个 base

## Task

- `POST /task` 用来创建子 agent 任务
- 子任务目录固定为 `<parentBaseDir>/agent/<taskName>/`
- 默认只需要传：
  - `name`
  - `detail`
- parent base 默认按当前 active base 自动补全
- system 和初始消息由服务自动注入
- 服务会立即返回 `accepted`
- 子任务在后台执行
- 执行完成后，服务会自动往父 base 追加一条 `user` 消息，格式为：
  - `[agent:<taskName>][status:done]`
  - 或 `[agent:<taskName>][status:error]`

## Stream

- CLI 使用单条长期 SSE：`GET /base/stream?baseDir=...`
- 用户输入通过 `POST /chat` 投递
- 工具调用、工具结果、assistant 回复、子任务完成后的父 agent 自动继续运行，都会从这条 base stream 推送回来
