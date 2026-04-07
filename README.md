# AGENT

AGENT 是一个本地优先的命令行 agent。它包含两部分：

- 一个交互式 CLI，命令是 `agent`
- 一个本地 HTTP 服务，负责多轮对话、工具调用和 task 执行

当前默认只内置一个工具：

- `shell`，用于执行 shell 命令并返回输出

## 目录结构

```text
AGENT/
  package.json
  package-lock.json
  README.md
  install.sh
  Dockerfile
  docker-compose.yml
  bin/
    agent.js
  src/
    cli/
      index.js
      args.js
      base.js
      config-file.js
      constants.js
      printer.js
      server.js
      session.js
      stream.js
    server/
      index.js
      routes.js
      runtime.js
      http.js
      events.js
    agent/
      handler.js
      runner.js
      tools.js
      functions.js
      utils.js
    core/
      config.js
      llm.js
      utils.js
```

## 安装

Linux 服务器上一条命令安装：

```bash
curl -fsSL https://raw.githubusercontent.com/valueriver/AGENT/main/install.sh | bash
```

如果已经 clone 到本地，也可以直接执行：

```bash
chmod +x install.sh
./install.sh
```

安装脚本会自动：

- 安装 `git`
- 安装 `node` 和 `npm`
- 从 GitHub 拉取代码
- 安装依赖
- 创建 `agent` 命令
- 启动本地服务

## 配置

推荐直接用 CLI 写入配置文件：

```bash
agent --config https://api.openai.com/v1/chat/completions YOUR_API_KEY gpt-4.1-mini
```

这条命令会生成：

```text
~/.config/agent-cli/config.env
```

也可以使用环境变量：

```bash
export AGENT_API_URL=https://api.openai.com/v1/chat/completions
export OPENAI_API_KEY=YOUR_API_KEY
export AGENT_MODEL=gpt-4.1-mini
```

配置优先级：

1. 命令行参数
2. `src/core/config.js` 默认值
3. 环境变量

## 使用

进入交互模式：

```bash
agent
```

单次执行：

```bash
agent "帮我看看当前目录"
```

加载最近一次 base：

```bash
agent -1
```

加载指定 base：

```bash
agent 3
```

查看帮助：

```bash
agent --help
```

## 本地开发

安装依赖：

```bash
npm install
```

启动服务：

```bash
npm run serve
```

另一个终端进入 CLI：

```bash
node ./bin/agent.js
```

## Docker

构建镜像：

```bash
docker build -t agent-cli .
```

启动容器：

```bash
docker run -d \
  --name agent-cli \
  -p 9503:9503 \
  -e OPENAI_API_KEY=YOUR_API_KEY \
  -e AGENT_MODEL=gpt-4.1-mini \
  -v "$(pwd)/bases:/app/bases" \
  agent-cli
```

也可以直接用 Compose：

```bash
docker compose up -d --build
```

容器默认只启动本地服务 `src/server/index.js`。如果你要进入容器内使用 CLI：

```bash
docker exec -it agent-cli node ./bin/agent.js
```

停止容器：

```bash
docker compose down
```

## 服务接口

本地服务默认监听：

```text
http://127.0.0.1:9503
```

接口：

- `GET /health`
- `POST /chat`
- `GET /base/stream`
- `POST /task`

## Base 与 Task

- 每个 base 对应一个目录
- 对话历史写入 `bases/<id>/messages.json`
- 子任务写入 `<parentBase>/agent/<taskName>/messages.json`
- 子任务完成后，结果会自动追加回父 base，并触发父 agent 继续运行
