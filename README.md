# AGENT Web

AGENT Web 是一个基于 Web 的 AI 智能代理应用，支持多会话管理、实时流式输出和工具调用可视化。

## 特性

- 🌐 **Web 界面** - 现代化的浏览器交互界面
- 💬 **多会话管理** - 同时管理多个对话上下文
- 🔄 **实时流式输出** - SSE 实时推送工具调用和结果
- 🛠️ **工具调用可视化** - 清晰展示 shell 命令执行过程
- 📝 **Markdown 渲染** - 完整的 Markdown 格式支持
- 🎨 **暗色主题** - 舒适的深色 UI
- 📱 **响应式设计** - 适配桌面和移动设备

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置

模型配置只通过 Web GUI 的设置面板保存到本地数据库：

```bash
# 启动服务后，在界面设置中填写：
# - API URL
# - API Key
# - Model
```

### 开发模式

同时启动前端和后端：

```bash
npm run dev
```

或分别启动：

```bash
# 启动后端服务 (端口 9503)
npm run dev:server

# 启动前端开发服务器 (端口 5173)
npm run dev:web
```

### 生产模式

构建前端并启动服务：

```bash
# 构建前端
npm run build:web

# 启动服务
npm start
```

访问 http://localhost:9503

首次启动后，需要先在界面设置中保存模型配置，然后再发起对话。服务不再读取 `.env` 或模型相关环境变量。

## Docker 部署

```bash
# 构建并启动
docker compose up -d --build

# 访问
open http://localhost:9503
```

## 项目结构

```
AGENT/
  package.json
  docker-compose.yml
  data/
    agent.db              # SQLite 数据库（含 GUI 配置）
  src/
    server/               # 后端服务
      index.js            # HTTP 服务器入口
      routes.js           # API 路由和静态文件服务
      runtime.js          # 代理运行逻辑
      http.js             # HTTP 辅助
      events.js           # SSE 事件系统
    agent/                # AI 代理核心
      handler.js          # 对话处理循环
      runner.js           # 工具执行
      tools.js            # 工具定义
      functions.js        # 内置工具 (shell)
      utils.js            # 工具函数
    core/                 # 核心模块
      config-server.js    # GUI 配置读写
      db.js               # SQLite 持久化
      llm.js              # LLM API 调用
      utils.js            # 文件工具
    gui/                  # 前端应用
      package.json
      vite.config.js
      src/
        main.jsx          # React 入口
        App.jsx           # 主应用组件
        index.css         # 全局样式
        api/
          index.js        # API 客户端
        components/
          Sidebar.jsx     # 侧边栏组件
          ChatWindow.jsx  # 聊天窗口组件
          MessageBubble.jsx # 消息气泡组件
```

## API 接口

后端服务默认监听 `http://127.0.0.1:9503`

### 对话相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/chat` | 发送聊天消息 |
| GET | `/conversation/stream?conversationId=<id>` | SSE 事件流 |
| POST | `/task` | 创建子任务 |

### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/conversations` | 获取所有会话列表 |
| POST | `/api/conversations` | 创建新会话 |
| DELETE | `/api/conversations/<id>` | 删除会话 |
| GET | `/api/conversations/<id>/messages` | 获取会话消息历史 |
| GET | `/api/conversations/<id>/stats` | 获取会话用量统计 |
| GET | `/api/config` | 获取 GUI 保存的模型配置 |
| POST | `/api/config` | 保存 GUI 模型配置 |

## 架构

```
┌─────────────────────┐
│   浏览器 (React)     │
│   - 侧边栏           │
│   - 聊天窗口         │
│   - 消息气泡         │
└──────────┬──────────┘
           │ HTTP + SSE
┌──────────▼──────────┐
│   HTTP Server       │
│   - REST API        │
│   - SSE 事件流      │
│   - 静态文件服务     │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Agent Core        │
│   - LLM 调用        │
│   - 工具执行        │
│   - 多轮对话循环     │
└─────────────────────┘
```

## Conversation 与 Task

- 每个 **conversation** 都由数据库中的一条会话记录表示
- 对话历史和用量都保存在 SQLite 中
- **子任务** 会创建独立的子会话，由 `parentConversationId` 关联
- 子任务完成后，结果自动追加回父会话

## 内置工具

当前内置了一个增强版工具：

- **shell**
  - `action=exec`：前台执行并直接返回结果
  - `action=start`：启动后台命令并返回 `sessionId`
  - `action=poll`：查询后台会话状态和输出
  - `action=write`：向后台会话写入 stdin
  - `action=kill`：结束后台会话
  - `action=list`：列出当前后台会话
  - 支持 `cwd`、`timeoutSeconds`、输出截断
  - 当前 `terminal` 参数仅保留接口，尚未真正实现

## 技术栈

**后端:**
- Node.js (ES Modules)
- 原生 HTTP 模块
- SSE (Server-Sent Events)

**前端:**
- React 19
- Vite 6
- Tailwind CSS 4
- Marked (Markdown 渲染)

## License

MIT
