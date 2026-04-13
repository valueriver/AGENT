const API_BASE = "";

export const api = {
  health: () => fetch(`${API_BASE}/health`).then((r) => r.json()),

  getConfig: () => fetch(`${API_BASE}/api/config`).then((r) => r.json()),

  setConfig: (cfg) =>
    fetch(`${API_BASE}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    }).then((r) => r.json()),

  getConversations: (page = 1, limit = 20, search = "") => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set("search", search);
    return fetch(`${API_BASE}/api/conversations?${params}`).then((r) => r.json());
  },

  createConversation: () =>
    fetch(`${API_BASE}/api/conversations`, { method: "POST" }).then((r) => r.json()),

  deleteConversation: (id) =>
    fetch(`${API_BASE}/api/conversations/${id}`, { method: "DELETE" }).then((r) => r.json()),

  getMessages: (conversationId, page = 1, limit = 50, order = "asc") =>
    fetch(
      `${API_BASE}/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}&order=${order}`
    ).then((r) => r.json()),

  getConversationStats: (conversationId) =>
    fetch(`${API_BASE}/api/conversations/${conversationId}/stats`).then((r) => r.json()),

  search: (query, page = 1, limit = 20) =>
    fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`).then((r) => r.json()),

  chat: (conversationId, message, options = {}) =>
    fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        prompt: message,
        ...options,
      }),
    }).then((r) => r.json()),

  stopChat: (conversationId) =>
    fetch(`${API_BASE}/chat/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    }).then((r) => r.json()),

  createTask: (parentConversationId, name, detail) =>
    fetch(`${API_BASE}/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentConversationId,
        name,
        detail,
      }),
    }).then((r) => r.json()),

  streamEvents: (conversationId, onEvent, onError, onOpen) => {
    const url = `${API_BASE}/conversation/stream?conversationId=${encodeURIComponent(conversationId)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = onOpen || (() => {});

    for (const type of ["start", "tool_call", "delta", "tool_result", "done", "usage", "saved", "stopped", "end"]) {
      eventSource.addEventListener(type, (e) => {
        const data = JSON.parse(e.data);
        onEvent?.(type, data);
      });
    }

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
