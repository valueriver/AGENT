const API_BASE = "";

export const api = {
  // 健康检查
  health: () => fetch(`${API_BASE}/health`).then((r) => r.json()),

  // 获取配置
  getConfig: () => fetch(`${API_BASE}/api/config`).then((r) => r.json()),

  // 保存配置
  setConfig: (cfg) =>
    fetch(`${API_BASE}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    }).then((r) => r.json()),

  // 获取所有 bases (支持分页和搜索)
  getBases: (page = 1, limit = 20, search = "") => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set("search", search);
    return fetch(`${API_BASE}/api/bases?${params}`).then((r) => r.json());
  },

  // 创建新 base
  createBase: () =>
    fetch(`${API_BASE}/api/bases`, { method: "POST" }).then((r) => r.json()),

  // 删除 base
  deleteBase: (id) =>
    fetch(`${API_BASE}/api/bases/${id}`, { method: "DELETE" }).then((r) =>
      r.json()
    ),

  // 获取消息历史 (支持分页)
  getMessages: (baseId, page = 1, limit = 50, order = "asc") =>
    fetch(`${API_BASE}/api/bases/${baseId}/messages?page=${page}&limit=${limit}&order=${order}`).then((r) => r.json()),

  // 获取当前会话统计
  getBaseStats: (baseId) =>
    fetch(`${API_BASE}/api/bases/${baseId}/stats`).then((r) => r.json()),

  // 搜索消息
  search: (query, page = 1, limit = 20) =>
    fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`).then((r) => r.json()),

  // 发送聊天消息
  chat: (baseDir, message, options = {}) =>
    fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseDir,
        prompt: message,
        ...options,
      }),
    }).then((r) => r.json()),

  // 创建子任务
  createTask: (parentBaseDir, name, detail) =>
    fetch(`${API_BASE}/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentBaseDir,
        name,
        detail,
      }),
    }).then((r) => r.json()),

  // SSE 流式连接
  streamEvents: (baseDir, onEvent, onError, onOpen) => {
    const url = `${API_BASE}/base/stream?baseDir=${encodeURIComponent(baseDir)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = onOpen || (() => {});

    eventSource.addEventListener("tool_call", (e) => {
      const data = JSON.parse(e.data);
      onEvent?.("tool_call", data);
    });

    eventSource.addEventListener("delta", (e) => {
      const data = JSON.parse(e.data);
      onEvent?.("delta", data);
    });

    eventSource.addEventListener("tool_result", (e) => {
      const data = JSON.parse(e.data);
      onEvent?.("tool_result", data);
    });

    eventSource.addEventListener("done", (e) => {
      const data = JSON.parse(e.data);
      onEvent?.("done", data);
    });

    eventSource.addEventListener("usage", (e) => {
      const data = JSON.parse(e.data);
      onEvent?.("usage", data);
    });

    eventSource.addEventListener("saved", (e) => {
      const data = JSON.parse(e.data);
      onEvent?.("saved", data);
    });

    eventSource.addEventListener("error", (e) => {
      const data = JSON.parse(e.data);
      onError?.(data);
      eventSource.close();
    });

    eventSource.onerror = () => {
      onError?.({ error: "Connection lost" });
      eventSource.close();
    };

    return eventSource;
  },
};
