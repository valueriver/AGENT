# AGENT

AGENT 是一个本地运行的 agent 内核。

它不是前端应用，也不是一套大而全的平台。当前项目只保留四个核心关注点：

- `agent`：无状态执行器，负责 LM 调用、工具调用、消息循环
- `server`：有状态编排器，负责 HTTP API、上下文恢复、持久化、任务管理
- `cli`：终端交互入口
- `database`：SQLite 数据目录

项目目标很明确：把 agent 做成一个干净的本地内核，CLI、自调用任务、历史消息、配置管理都围绕这套内核运行。

## 核心原则

- `agent` 不负责历史记录、数据库、业务编排
- `server` 负责查询上下文、拼装 prompt、保存消息、创建任务
- `cli` 只是客户端，不负责上下文拼装
- 所有对外交互都收口到 HTTP API
- 聊天接口是单接口 SSE，不再拆成 `start + stream + stop`

一句话概括当前分层：

- `agent` 是无状态执行器
- `server` 是有状态应用层

## 目录结构

```text
AGENT/
  index.js
  package.json
  install.sh
  database/
    agent.db
  agent/
    handler.js
    runner.js
    tools.js
    utils.js
    lm/
    functions/
  gui/
    package.json
    vite.config.js
    src/
  server/
    index.js
    utils.js
    api/
    services/
    repository/
  cli/
    index.js
    runtime.js
    commands/
    lib/
```

各目录职责：

- `index.js`
  server 入口，默认监听 `9500`

- `agent/`
  agent 执行核心。只接收消息和运行参数，然后输出事件和结果

- `server/api/`
  HTTP 路由层，只做请求分发和参数进入

- `server/services/`
  应用服务层，负责上下文恢复、prompt 组织、任务编排、统计聚合

- `server/repository/`
  SQLite 读写层

- `gui/`
  Vue + Vite Web 客户端，只通过 HTTP API 访问 `server`

- `cli/commands/`
  CLI 命令实现，例如 `repl`、`chat`、`settings`、`health`

- `cli/lib/`
  CLI 复用能力，例如 HTTP 请求、SSE 读取、自动拉起 server

## 数据流

一次 CLI 对话的大致流程：

1. CLI 发送本轮输入
2. server 根据 `conversationId` 查询历史消息
3. server 按 `contextTurns` 截取上下文
4. server 读取 settings 中的模型配置和用户 system prompt
5. server 追加运行时上下文信息，组织完整 messages
6. server 调用 `agent`
7. `agent` 调 LM，处理 tool call / tool result / final answer
8. server 将新增消息落库
9. server 通过 SSE 把事件持续返回给 CLI

所以有一个重要边界：

- CLI 发送的是本轮输入
- server 组织的是完整上下文
- agent 执行的是已经准备好的消息列表

## Prompt 设计

Prompt 不全在数据库里，也不应该全在数据库里。

当前设计应该理解成三部分：

- 应用内置 prompt：属于 server 应用层逻辑
- 用户自定义 system：存在 settings 中
- 运行时上下文 prompt：server 根据会话和任务实时拼装

最终发给模型的 system prompt，是 server 在运行时合成的结果，不是 CLI 拼的，也不是 agent 自己查库拼的。

## 消息存储

消息表不是拆成 `role/content/tool_calls/usage` 这类很多字段，而是按整条 message 对象存储。

也就是：

- `messages.message`：完整 message JSON
- `messages.meta`：附加元数据
- `anchors`：独立锚点表，按 `conversation_id + message_id` 关联回消息

这样存的好处是：

- 存储模型简单
- 能兼容不同类型的 message 结构
- 不会让数据库 schema 反向绑死 agent 的消息协议

## 对话与任务

项目里有两种核心运行形态：

### 对话

对话通过 `POST /api/chat` 执行，直接返回 SSE。

这个接口负责：

- 接收 `conversationId`
- 接收本轮 `prompt`
- 持续返回 `delta`、`tool_call`、`tool_result`、`done`、`error`

### 任务

任务通过 `POST /api/tasks` 创建。

任务的定位是：

- 后台执行
- 允许 agent 自己创建子任务
- 通过子会话和父会话关联

这就是项目保留 HTTP 能力的原因之一：agent 的自调用和多任务能力，最终都可以统一成对 server API 的调用。

## HTTP API

当前主要接口如下：

- `GET /health`
- `POST /api/chat`
- `GET /api/conversations`
- `POST /api/conversations`
- `DELETE /api/conversations?id=N`
- `GET /api/messages?conversationId=N`
- `GET /api/anchors?conversationId=N`
- `POST /api/tasks`
- `GET /api/tasks`
- `PATCH /api/tasks?id=N`
- `GET /api/memories`
- `POST /api/memories`
- `PATCH /api/memories?id=N`
- `DELETE /api/memories?id=N`
- `GET /api/settings`
- `POST /api/settings`

说明：

- 路由风格尽量保持简单
- 资源名统一放在 `/api/*`
- server 对外暴露的是应用接口，不暴露内部实现细节

## 启动命令

根项目现在只保留三个启动命令：

- `npm start`
  纯启动 server

- `npm run cli`
  自动启动 server，然后进入 CLI

- `npm run gui`
  自动启动 server，然后启动 GUI

## 快速开始

安装依赖：

```bash
npm install
```

启动 server：

```bash
npm start
```

健康检查：

```bash
node cli/index.js health
```

进入 CLI：

```bash
npm run cli
```

读取配置：

```bash
node cli/index.js settings get
```

写入配置：

```bash
node cli/index.js settings set \
  apiUrl=https://api.openai.com/v1/chat/completions \
  apiKey=sk-xxx \
  model=gpt-5.4 \
  contextTurns=10
```

首次启动建议按这个顺序：

1. `npm install`
2. `npm start`
3. `node cli/index.js settings set apiUrl=... apiKey=... model=...`
4. `npm run cli`

## CLI

CLI 现在已经按职责拆分：

- `cli/index.js`：入口和命令分发
- `cli/runtime.js`：CLI 运行时常量
- `cli/lib/http.js`：HTTP 请求
- `cli/lib/server.js`：server 探活和自动拉起
- `cli/lib/sse.js`：SSE 读取
- `cli/lib/chat.js`：聊天相关客户端逻辑
- `cli/commands/*.js`：具体命令

这样做的目的是：

- 入口文件保持薄
- 命令逻辑独立
- 协议细节集中在 `lib/`
- 后续新增命令不会继续把入口堆成大文件

## GUI

`gui/` 是独立前端工程，不直接 import `agent` 或 `server` 代码。

开发模式：

```bash
cd gui
npm install
npm run dev
```

默认端口：

- GUI: `http://127.0.0.1:5173`
- Server: `http://127.0.0.1:9500`

Vite 已配置代理：

- `/api/*` -> `9500`
- `/health` -> `9500`

根目录提供统一入口：

```bash
npm run gui
```

## Docker

启动：

```bash
docker compose up --build
```

容器默认：

- 监听 `9500`
- 将数据库持久化到 `./database`

健康检查：

```bash
curl http://127.0.0.1:9500/health
```

## install.sh

仓库根目录提供 `install.sh`。

它会：

- 克隆或更新代码
- 安装依赖
- 写入 `agent` 命令包装器
- 启动本地 server

执行方式：

```bash
./install.sh
```

安装完成后可直接使用：

```bash
agent
agent chat "你好"
agent settings get
```

## 适合做什么

这个项目适合做：

- 本地 agent 内核实验
- CLI agent
- 任务型 agent
- 需要多任务/子任务能力的 agent 服务
- 需要本地 SQLite 持久化的轻量应用层

它当前不打算做的事情：

- GUI
- 前后端混合工程
- 把所有业务逻辑塞进 agent 核心

## 当前状态

项目已经完成的方向：

- GUI 已清理
- 结构收敛为 `agent / server / cli / database`
- LM 已归入 `agent/lm`
- 对话接口改成单 SSE 接口
- 消息改成整对象存储
- CLI 已完成分层拆分

接下来如果继续收敛，优先级通常会是：

- 将 prompt 体系继续从 service 中抽成独立 `server/prompts/`
- 继续清理命名和资源边界
- 对任务、记忆、统计等资源做更明确的应用层抽象
