import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { Settings } from "./components/Settings";
import { SearchModal } from "./components/SearchModal";
import { Pagination } from "./components/Pagination";
import { api } from "./api";

// 聊天页面组件
function ChatPage({ serverConfig, onOpenSettings, onOpenSearch }) {
  const { baseId } = useParams();
  const navigate = useNavigate();
  const [bases, setBases] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [basePage, setBasePage] = useState(1);
  const [baseTotalPages, setBaseTotalPages] = useState(1);
  const [msgPage, setMsgPage] = useState(1);
  const [msgTotalPages, setMsgTotalPages] = useState(1);

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

  const loadMessages = useCallback(async (id, page = 1) => {
    try {
      const res = await api.getMessages(id, page);
      if (res.ok) {
        setMessages(res.messages);
        setMsgTotalPages(res.totalPages);
        setMsgPage(res.page);
      }
    } catch (err) { console.error("Failed to load messages:", err); }
  }, []);

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

    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: content.trim() }]);

    try {
      api.streamEvents(
        baseId,
        (type, data) => {
          if (type === "tool_call") setMessages((p) => [...p, { role: "assistant", type: "tool_call", ...data }]);
          else if (type === "tool_result") setMessages((p) => [...p, { role: "assistant", type: "tool_result", ...data }]);
          else if (type === "done") loadMessages(baseId, msgPage);
        },
        (error) => setMessages((p) => [...p, { role: "assistant", content: `❌ 错误: ${error.error}` }])
      );
      await api.chat(baseId, content.trim());
    } catch (err) {
      setMessages((p) => [...p, { role: "assistant", content: `❌ 请求失败: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadBases(basePage); }, [loadBases, basePage]);
  useEffect(() => { if (baseId) loadMessages(baseId, 1); setMsgPage(1); setMsgTotalPages(1); }, [baseId, loadMessages]);

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
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          msgPage={msgPage}
          msgTotalPages={msgTotalPages}
          onMsgPageChange={(p) => loadMessages(baseId, p)}
          onOpenSearch={onOpenSearch}
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
