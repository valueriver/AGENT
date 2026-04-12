import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";

const NEAR_BOTTOM_THRESHOLD = 120;
const GPT54_STANDARD_PRICING = {
  inputPerMillion: 2.5,
  cachedInputPerMillion: 0.25,
  outputPerMillion: 15,
  sourceUrl: "https://developers.openai.com/api/docs/pricing",
  checkedAt: "2026-04-12",
};

const formatInteger = (value) => new Intl.NumberFormat("zh-CN").format(value || 0);

const formatUsd = (value) => {
  if (!Number.isFinite(value)) return "-";
  if (value === 0) return "$0.000000";
  if (value < 0.000001) return "< $0.000001";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(value);
};

export function ChatWindow({
  base,
  messages,
  sessionUsage,
  serverConfig,
  isLoading,
  hasOlderMessages,
  isLoadingOlder,
  onLoadOlder,
  onSendMessage,
  onToggleSidebar,
  onOpenSettings,
}) {
  const [input, setInput] = useState("");
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const sessionPanelRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const prependAnchorRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const modelName = String(serverConfig?.model || "").trim();
  const promptTokens = Number(sessionUsage?.promptTokens) || 0;
  const cachedPromptTokens = Number(sessionUsage?.cachedPromptTokens) || 0;
  const completionTokens = Number(sessionUsage?.completionTokens) || 0;
  const totalTokens = Number(sessionUsage?.totalTokens) || 0;
  const uncachedPromptTokens = Math.max(0, promptTokens - cachedPromptTokens);
  const hasGpt54Pricing = modelName.startsWith("gpt-5.4");
  const estimatedCost = hasGpt54Pricing
    ? (
      (uncachedPromptTokens * GPT54_STANDARD_PRICING.inputPerMillion) +
      (cachedPromptTokens * GPT54_STANDARD_PRICING.cachedInputPerMillion) +
      (completionTokens * GPT54_STANDARD_PRICING.outputPerMillion)
    ) / 1_000_000
    : null;

  const scrollToBottom = (behavior = "smooth") => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  const updateScrollState = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
    shouldStickToBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom && messages.length > 0);
  };

  useEffect(() => {
    updateScrollState();
  }, [messages.length]);

  useEffect(() => {
    prevMessageCountRef.current = 0;
    prependAnchorRef.current = null;
    shouldStickToBottomRef.current = true;
    setShowScrollToBottom(false);
    setSessionPanelOpen(false);
  }, [base.id]);

  useEffect(() => {
    if (!sessionPanelOpen) return undefined;
    const handlePointerDown = (event) => {
      if (sessionPanelRef.current && !sessionPanelRef.current.contains(event.target)) {
        setSessionPanelOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSessionPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [sessionPanelOpen]);

  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const prevCount = prevMessageCountRef.current;
    const countDiff = messages.length - prevCount;

    if (prependAnchorRef.current && countDiff > 0) {
      const prevHeight = prependAnchorRef.current;
      prependAnchorRef.current = null;
      el.scrollTop = el.scrollHeight - prevHeight;
      prevMessageCountRef.current = messages.length;
      updateScrollState();
      return;
    }

    if (countDiff > 0 && shouldStickToBottomRef.current) {
      scrollToBottom(prevCount === 0 ? "auto" : "smooth");
    }

    prevMessageCountRef.current = messages.length;
    updateScrollState();
  }, [messages]);

  const handleLoadOlder = async () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    prependAnchorRef.current = el.scrollHeight;
    await onLoadOlder?.();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      shouldStickToBottomRef.current = true;
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="relative z-30 overflow-visible px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur flex items-center justify-between">
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
            <span className="text-xl">AI</span>
            <span className="hidden sm:inline">会话 #{base.id}</span>
            <span className="sm:hidden">#{base.id}</span>
          </h1>
        </div>
        <div className="relative z-40 flex items-center gap-1" ref={sessionPanelRef}>
          <button
            type="button"
            onClick={() => setSessionPanelOpen((open) => !open)}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
            title="会话设置"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {sessionPanelOpen && (
            <div className="absolute right-0 top-12 z-50 w-[320px] rounded-2xl border border-gray-800 bg-gray-900/95 shadow-2xl backdrop-blur p-4 space-y-4">
              <div className="space-y-1">
                <div className="text-sm text-gray-400">当前会话</div>
                <div className="text-base font-semibold text-gray-100">会话 #{base.id}</div>
                <div className="text-xs text-gray-500 break-all">模型：{modelName || "未配置"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-800/70 px-3 py-2">
                  <div className="text-xs text-gray-500">输入 tokens</div>
                  <div className="mt-1 font-semibold">{formatInteger(promptTokens)}</div>
                </div>
                <div className="rounded-xl bg-gray-800/70 px-3 py-2">
                  <div className="text-xs text-gray-500">缓存输入</div>
                  <div className="mt-1 font-semibold">{formatInteger(cachedPromptTokens)}</div>
                </div>
                <div className="rounded-xl bg-gray-800/70 px-3 py-2">
                  <div className="text-xs text-gray-500">输出 tokens</div>
                  <div className="mt-1 font-semibold">{formatInteger(completionTokens)}</div>
                </div>
                <div className="rounded-xl bg-gray-800/70 px-3 py-2">
                  <div className="text-xs text-gray-500">总 tokens</div>
                  <div className="mt-1 font-semibold">{formatInteger(totalTokens)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-900/60 bg-blue-950/30 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-300">累计成本估算</span>
                  <span className="text-sm font-semibold text-blue-300">{hasGpt54Pricing ? formatUsd(estimatedCost) : "-"}</span>
                </div>
                <div className="text-xs text-gray-500 leading-5">
                  <div>标准价 / 1M tokens：输入 $2.50，缓存输入 $0.25，输出 $15.00</div>
                  <div>
                    来源：
                    <a
                      href={GPT54_STANDARD_PRICING.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 text-blue-400 hover:text-blue-300"
                    >
                      OpenAI Pricing
                    </a>
                    <span className="ml-1">({GPT54_STANDARD_PRICING.checkedAt})</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>已记录 {formatInteger(sessionUsage?.recordedResponses || 0)} 次模型响应</span>
                <button
                  type="button"
                  onClick={() => {
                    setSessionPanelOpen(false);
                    onOpenSettings?.();
                  }}
                  className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                >
                  打开模型设置
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="relative flex-1 min-h-0">
        <div
          ref={messagesContainerRef}
          onScroll={updateScrollState}
          className="h-full overflow-y-auto px-2 sm:px-4 py-4 sm:py-6"
        >
          <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
            {hasOlderMessages && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={handleLoadOlder}
                  disabled={isLoadingOlder}
                  className="px-4 py-2 text-sm rounded-full border border-gray-700 bg-gray-900/70 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {isLoadingOlder ? "加载中..." : "加载更早消息"}
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-20">
                <div className="text-4xl mb-3">...</div>
                <p>开始新的对话吧</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} index={idx} />
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-gray-400 animate-pulse-slow px-4">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">AI 正在思考...</span>
              </div>
            )}
          </div>
        </div>

        {showScrollToBottom && (
          <button
            type="button"
            onClick={() => {
              shouldStickToBottomRef.current = true;
              scrollToBottom();
            }}
            className="absolute right-4 bottom-4 px-3 py-2 rounded-full bg-gray-800/95 border border-gray-700 text-sm text-gray-200 shadow-lg hover:bg-gray-700 transition-colors"
          >
            回到底部
          </button>
        )}
      </div>

      <div className="px-2 sm:px-4 py-3 sm:py-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur">
        <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 text-sm sm:text-base"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-2xl font-medium transition-colors flex items-center gap-2"
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
