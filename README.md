# AGENT Kernel

AGENT 现在按一个本地 agent 内核来组织，核心模块收敛为三层：

- `agent`：对话循环、工具执行、任务编排、LM 调用
- `server`：本地 HTTP API、配置存储、SQLite 持久化
- `cli`：终端交互入口

当前默认监听 `http://127.0.0.1:9500`。

## 快速开始

安装依赖：

```bash
npm install
```

启动本地 server：

```bash
npm start
```

查看健康状态：

```bash
node src/cli/index.js health
```

进入 CLI 交互：

```bash
npm run cli
```

单次发送一条消息：

```bash
npm run chat -- "你好，帮我检查当前目录结构"
```

读取当前配置：

```bash
node src/cli/index.js config get
```

写入模型配置：

```bash
node src/cli/index.js config set \
  apiUrl=https://api.openai.com/v1/chat/completions \
  apiKey=sk-xxx \
  model=gpt-5.4 \
  contextTurns=10
```

## 项目结构

```text
AGENT/
  index.js
  package.json
  src/
    database/
      agent.db
    agent/
      handler.js
      lm/
      runner.js
      tools.js
      functions/
    server/
      index.js
      api/
      repository/
      services/
      utils.js
    cli/
      index.js
```

## 关键接口

- `GET /health`
- `POST /api/chat`
- `POST /api/task`
- `GET /api/conversations`
- `POST /api/conversations`
- `DELETE /api/conversations/<id>`
- `GET /api/conversations/<id>/messages`
- `GET /api/conversations/<id>/stats`
- `GET /api/config`
- `POST /api/config`

## 设计说明

- `agent` 仍然保留多任务能力，子任务通过本地 HTTP `POST /api/task` 创建。
- `server` 只负责系统能力暴露和持久化，不负责前端页面。
- `cli` 通过同一套 HTTP API 与内核交互，和 agent 自调用保持一致。
- 历史会话、消息和配置都保存在本地 SQLite 中。
