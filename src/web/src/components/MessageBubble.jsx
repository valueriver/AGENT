import { useState } from "react";
import { marked } from "marked";

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

export function MessageBubble({ message, index }) {
  const [expanded, setExpanded] = useState(true);

  // 工具调用卡片
  if (message.type === "tool_call") {
    return (
      <div className="animate-fade-in">
        <div
          onClick={() => setExpanded(!expanded)}
          className="max-w-3xl mx-auto bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 cursor-pointer hover:bg-yellow-900/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-yellow-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium text-sm">工具调用: {message.name || "shell"}</span>
            <svg className={`w-4 h-4 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {expanded && message.arguments?.command && (
            <pre className="mt-2 text-xs bg-gray-900/50 p-2 rounded overflow-x-auto">
              <code>{message.arguments.command}</code>
            </pre>
          )}
        </div>
      </div>
    );
  }

  // 工具结果卡片
  if (message.type === "tool_result") {
    const output = message.content || message.result || "";
    const isError = output.includes("exit code:") && !output.includes("exit code: 0");
    const truncated = output.length > 500;
    const [showFull, setShowFull] = useState(false);

    return (
      <div className="animate-fade-in">
        <div className={`max-w-3xl mx-auto rounded-lg p-3 border ${
          isError ? "bg-red-900/20 border-red-700/50" : "bg-gray-800/50 border-gray-700/50"
        }`}>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>执行结果</span>
            {truncated && (
              <button
                onClick={() => setShowFull(!showFull)}
                className="ml-auto text-blue-400 hover:text-blue-300"
              >
                {showFull ? "收起" : "展开完整输出"}
              </button>
            )}
          </div>
          <pre className={`text-xs overflow-x-auto ${isError ? "text-red-300" : "text-gray-300"}`}>
            <code>{truncated && !showFull ? output.slice(0, 500) + "\n... [输出已截断]" : output}</code>
          </pre>
        </div>
      </div>
    );
  }

  // 用户消息
  if (message.role === "user") {
    return (
      <div className="animate-fade-in">
        <div className="max-w-3xl mx-auto flex justify-end px-2">
          <div className="bg-blue-600 rounded-lg px-3 sm:px-4 py-2 sm:py-3 max-w-[85%] sm:max-w-[80%] break-words">
            <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // 助手消息 (Markdown 渲染)
  if (message.role === "assistant") {
    const html = marked.parse(message.content || "");
    return (
      <div className="animate-fade-in">
        <div className="max-w-3xl mx-auto px-2">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
              AI
            </div>
            <div
              className="markdown-content flex-1 prose prose-invert prose-sm max-w-none text-sm sm:text-base"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>
    );
  }

  // 其他类型消息
  return (
    <div className="animate-fade-in">
      <div className="max-w-3xl mx-auto text-center text-gray-500 text-sm py-2">
        {message.content || JSON.stringify(message)}
      </div>
    </div>
  );
}
