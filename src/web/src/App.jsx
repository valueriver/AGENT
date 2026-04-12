import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { Settings } from "./components/Settings";
import { SearchModal } from "./components/SearchModal";
import { api } from "./api";

const MESSAGE_PAGE_SIZE = 50;
const EMPTY_USAGE = {
  promptTokens: 0,
  cachedPromptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  recordedResponses: 0,
};

const parseToolArguments = (raw) => {
  if (!raw) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
};

const normalizeUsage = (usage) => ({
  promptTokens: Math.max(0, Number(usage?.promptTokens) || 0),
  cachedPromptTokens: Math.max(0, Number(usage?.cachedPromptTokens) || 0),
  completionTokens: Math.max(0, Number(usage?.completionTokens) || 0),
  totalTokens: Math.max(0, Number(usage?.totalTokens) || 0),
  recordedResponses: Math.max(0, Number(usage?.recordedResponses) || 0),
});

const addUsage = (current, usage) => {
  const base = normalizeUsage(current);
  const next = normalizeUsage(usage);
  return {
    promptTokens: base.promptTokens + next.promptTokens,
    cachedPromptTokens: base.cachedPromptTokens + next.cachedPromptTokens,
    completionTokens: base.completionTokens + next.completionTokens,
    totalTokens: base.totalTokens + next.totalTokens,
    recordedResponses: base.recordedResponses + (next.totalTokens > 0 ? 1 : 0),
  };
};

// 聊天页面组件
function ChatPage({ serverConfig, onOpenSettings, onOpenSearch }) {
  const { baseId } = useParams();
  const navigate = useNavigate();
  const [bases, setBases] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sessionUsage, setSessionUsage] = useState(EMPTY_USAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [basePage, setBasePage] = useState(1);
  const [baseTotalPages, setBaseTotalPages] = useState(1);
  const [olderPage, setOlderPage] = useState(1);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const streamRef = useRef(null);
  const streamingAssistantIdRef = useRef(null);

  const loadBases = useCallback(async (page = 1) => {
    try {
      const res = await api.getBases(page);
      if (res.ok) {
        setBases(res.bases);
        setBaseTotalPages(res.totalPages);
        setBasePage(res.page);
      }
    } catch (err) { console.error("Failed to load bases:", err); }
  }, []);

  const loadLatestMessages = useCallback(async (id) => {
    try {
      const res = await api.getMessages(id, 1, MESSAGE_PAGE_SIZE, "desc");
      if (res.ok) {
        setMessages([...res.messages].reverse());
        setOlderPage(2);
        setHasOlderMessages(res.totalPages > 1);
      }
    } catch (err) { console.error("Failed to load messages:", err); }
  }, []);

  const loadBaseStats = useCallback(async (id) => {
    try {
      const res = await api.getBaseStats(id);
      if (res.ok) {
        setSessionUsage(normalizeUsage(res.usage));
      } else {
        setSessionUsage(EMPTY_USAGE);
      }
    } catch (err) {
      console.error("Failed to load base stats:", err);
      setSessionUsage(EMPTY_USAGE);
    }
  }, []);

  const loadOlderMessages = useCallback(async (id) => {
    if (!id || isLoadingOlder || !hasOlderMessages) return;

    setIsLoadingOlder(true);
    try {
      const res = await api.getMessages(id, olderPage, MESSAGE_PAGE_SIZE, "desc");
      if (res.ok) {
        const older = [...res.messages].reverse();
        setMessages((prev) => [...older, ...prev]);
        setOlderPage((prev) => prev + 1);
        setHasOlderMessages(olderPage < res.totalPages);
      }
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [hasOlderMessages, isLoadingOlder, olderPage]);

  const handleCreateBase = async () => {
    try {
      const res = await api.createBase();
      if (res.ok) {
        await loadBases(basePage);
        navigate(`/base/${res.base.id}`);
      }
    } catch (err) { console.error("Failed to create base:", err); }
  };

  const handleDeleteBase = async (id) => {
    try {
      await api.deleteBase(id);
      await loadBases(basePage);
      if (baseId === id) navigate("/");
    } catch (err) { console.error("Failed to delete base:", err); }
  };

  const handleSelectBase = (base) => {
    navigate(`/base/${base.id}`);
    setSidebarOpen(false);
  };

  const handleSendMessage = async (content) => {
    if (!baseId || !content.trim()) return;
    if (serverConfig === null) return;
    if (!serverConfig.apiUrl || !serverConfig.apiKey || !serverConfig.model) {
      onOpenSettings();
      return;
    }

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    setIsLoading(true);
    streamingAssistantIdRef.current = null;
    setMessages((prev) => [...prev, { role: "user", content: content.trim() }]);

    try {
      streamRef.current = api.streamEvents(
        baseId,
        (type, data) => {
          if (type === "delta") {
            setMessages((prev) => {
              const streamId = streamingAssistantIdRef.current || `assistant-stream-${Date.now()}`;
              streamingAssistantIdRef.current = streamId;
              const next = [...prev];
              const idx = next.findIndex((msg) => msg._streamId === streamId);
              if (idx >= 0) {
                next[idx] = {
                  ...next[idx],
                  content: `${next[idx].content || ""}${data.delta || ""}`,
                  streaming: true,
                };
              } else {
                next.push({
                  role: "assistant",
                  content: data.delta || "",
                  streaming: true,
                  _streamId: streamId,
                });
              }
              return next;
            });
          } else if (type === "tool_call") {
            setMessages((prev) => prev.map((msg) => (
              msg._streamId === streamingAssistantIdRef.current
                ? { ...msg, streaming: false }
                : msg
            )));
            streamingAssistantIdRef.current = null;
            setMessages((p) => [...p, {
              role: "assistant",
              type: "tool_call",
              name: data.toolCall?.function?.name || "shell",
              arguments: parseToolArguments(data.toolCall?.function?.arguments),
            }]);
          } else if (type === "tool_result") {
            setMessages((p) => [...p, {
              role: "assistant",
              type: "tool_result",
              content: data.message?.content || "",
            }]);
          } else if (type === "done") {
            setMessages((prev) => prev.map((msg) => (
              msg._streamId === streamingAssistantIdRef.current
                ? { ...msg, streaming: false }
                : msg
            )));
            streamingAssistantIdRef.current = null;
            setIsLoading(false);
          } else if (type === "usage") {
            setSessionUsage((prev) => addUsage(prev, data.usage));
          } else if (type === "saved") {
            streamRef.current?.close?.();
            streamRef.current = null;
            loadBases(1);
          }
        },
        (error) => {
          streamingAssistantIdRef.current = null;
          setIsLoading(false);
          setMessages((p) => [...p, { role: "assistant", content: `❌ 错误: ${error.error}` }]);
        }
      );
      await api.chat(baseId, content.trim());
    } catch (err) {
      streamingAssistantIdRef.current = null;
      setIsLoading(false);
      setMessages((p) => [...p, { role: "assistant", content: `❌ 请求失败: ${err.message}` }]);
    }
  };

  useEffect(() => { loadBases(basePage); }, [loadBases, basePage]);
  useEffect(() => {
    setMessages([]);
    setSessionUsage(EMPTY_USAGE);
    setOlderPage(1);
    setHasOlderMessages(false);
    setIsLoadingOlder(false);
    if (baseId) {
      loadLatestMessages(baseId);
      loadBaseStats(baseId);
    }
  }, [baseId, loadBaseStats, loadLatestMessages]);
  useEffect(() => () => {
    streamRef.current?.close?.();
  }, []);

  const currentBase = bases.find(b => b.id === baseId);
  if (!currentBase && baseId) return <div className="flex h-screen items-center justify-center text-gray-500">加载中...</div>;
  if (!baseId) return <div className="flex h-screen items-center justify-center text-gray-500">加载中...</div>;

  return (
    <div className="flex h-screen h-[100dvh] bg-gray-950 text-gray-100 overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`fixed lg:relative z-40 h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar
          bases={bases}
          activeBase={currentBase}
          isOpen={true}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onSelectBase={handleSelectBase}
          onCreateBase={handleCreateBase}
          onDeleteBase={handleDeleteBase}
          onOpenSettings={onOpenSettings}
          onOpenSearch={onOpenSearch}
          basePage={basePage}
          baseTotalPages={baseTotalPages}
          onBasePageChange={setBasePage}
        />
      </div>
      <main className="flex-1 flex flex-col min-w-0">
        <ChatWindow
          base={currentBase}
          messages={messages}
          sessionUsage={sessionUsage}
          serverConfig={serverConfig}
          isLoading={isLoading}
          hasOlderMessages={hasOlderMessages}
          isLoadingOlder={isLoadingOlder}
          onLoadOlder={() => loadOlderMessages(baseId)}
          onSendMessage={handleSendMessage}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenSettings={onOpenSettings}
        />
      </main>
    </div>
  );
}

// 首页重定向
function HomeRedirect() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBases(1, 1).then(res => {
      if (res.ok && res.bases.length > 0) {
        navigate(`/base/${res.bases[0].id}`, { replace: true });
      } else {
        api.createBase().then(r => {
          if (r.ok) navigate(`/base/${r.base.id}`, { replace: true });
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [navigate]);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">加载中...</div>;
  return null;
}

function App() {
  const [serverConfig, setServerConfig] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.getConfig();
      if (res.ok) setServerConfig(res.config);
    } catch (err) { console.error("Failed to load config:", err); }
  }, []);

  const handleSaveSettings = async (settings) => {
    try {
      await api.setConfig(settings);
      setServerConfig(settings);
    } catch (err) { console.error("Failed to save config:", err); }
  };

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // 键盘快捷键: Ctrl+K 打开搜索
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/base/:baseId" element={
          <ChatPage serverConfig={serverConfig} onOpenSettings={() => setSettingsOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        currentConfig={serverConfig}
      />

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </BrowserRouter>
  );
}

export default App;
