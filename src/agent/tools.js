const tools = [
  {
    type: "function",
    function: {
      name: "pty_exec",
      description: "在固定尺寸的 PTY 终端中执行一条命令，并等待结束。",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "要执行的终端命令。",
          },
          cwd: {
            type: "string",
            description: "命令工作目录。未提供时默认使用当前服务进程 cwd。",
          },
          timeoutSeconds: {
            type: "integer",
            description: "超时时间（秒）。默认 30 秒。",
          },
          env: {
            type: "object",
            description: "附加环境变量对象。键值都会按字符串处理。",
          },
          input: {
            type: "string",
            description: "启动后立即写入 PTY 的输入内容。",
          },
          maxOutputChars: {
            type: "integer",
            description: "输出截断上限，默认 20000。",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pty_start",
      description: "启动一个可持续读写的 PTY 会话。",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "要启动的终端命令。",
          },
          cwd: {
            type: "string",
            description: "命令工作目录。未提供时默认使用当前服务进程 cwd。",
          },
          timeoutSeconds: {
            type: "integer",
            description: "超时时间（秒）。设为 0 表示不自动超时。",
          },
          env: {
            type: "object",
            description: "附加环境变量对象。键值都会按字符串处理。",
          },
          input: {
            type: "string",
            description: "启动后立即写入 PTY 的输入内容。",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pty_read",
      description: "读取 PTY 会话的当前输出和状态。",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "PTY 会话 ID。",
          },
          maxOutputChars: {
            type: "integer",
            description: "输出截断上限，默认 20000。",
          },
        },
        required: ["sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pty_write",
      description: "向 PTY 会话写入输入。",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "PTY 会话 ID。",
          },
          input: {
            type: "string",
            description: "要写入 PTY 的内容。",
          },
          closeStdin: {
            type: "boolean",
            description: "是否发送 EOT（Ctrl+D），用于通知程序输入结束。",
          },
          maxOutputChars: {
            type: "integer",
            description: "输出截断上限，默认 20000。",
          },
        },
        required: ["sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pty_kill",
      description: "结束一个 PTY 会话并回收它。",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "PTY 会话 ID。",
          },
          signal: {
            type: "string",
            description: "发送的信号名，默认 SIGTERM。",
          },
          maxOutputChars: {
            type: "integer",
            description: "输出截断上限，默认 20000。",
          },
        },
        required: ["sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pty_list",
      description: "列出当前所有 PTY 会话。",
      parameters: {
        type: "object",
        properties: {
          maxOutputChars: {
            type: "integer",
            description: "输出截断上限，默认 20000。",
          },
        },
      },
    },
  },
];

export { tools };
