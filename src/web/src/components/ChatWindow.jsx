import { useState, useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { Pagination } from "./Pagination";

export function ChatWindow({ base, messages, isLoading, onSendMessage, onToggleSidebar, msgPage, msgTotalPages, onMsgPageChange, onOpenSearch }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 提交消息
  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  // 快捷键 Enter 发送
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="p-2 lg:hidden text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors mr-1"
            title="打开侧边栏"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span className="hidden sm:inline">会话 #{base.id}</span>
            <span className="sm:hidden">#{base.id}</span>
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSearch}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
            title="搜索 (Ctrl+K)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <div className="text-4xl mb-3">💭</div>
            <p>开始新的对话吧！</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} index={idx} />
          ))
        )}

        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400 animate-pulse-slow px-4">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">AI 正在思考...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 消息分页 */}
      {msgTotalPages > 1 && (
        <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/30">
          <Pagination page={msgPage} totalPages={msgTotalPages} onPageChange={onMsgPageChange} />
        </div>
      )}

      {/* 输入框 */}
      <div className="px-2 sm:px-4 py-3 sm:py-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur">
        <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 text-sm sm:text-base"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="hidden sm:inline">发送</span>
          </button>
        </form>
      </div>
    </div>
  );
}
