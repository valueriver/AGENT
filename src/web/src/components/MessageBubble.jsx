import { useState } from "react";
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const parseToolArguments = (raw) => {
  if (!raw) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
};

function ToolMessageCard({ callMessage, resultMessage, compact = false }) {
  const [expanded, setExpanded] = useState(true);
  const [showFull, setShowFull] = useState(false);
  const toolCalls = Array.isArray(callMessage?.tool_calls) ? callMessage.tool_calls : [];
  const toolName = callMessage?.name || toolCalls[0]?.function?.name || "shell";
  const toolArguments = callMessage?.arguments || parseToolArguments(toolCalls[0]?.function?.arguments);
  const output = resultMessage?.content || resultMessage?.result || "";
  const isError = output.includes("exit code:") && !output.includes("exit code: 0");
  const truncated = output.length > 500;

  return (
    <div className={`animate-fade-in ${compact ? "mt-2" : ""}`}>
      <div className="max-w-3xl mx-auto rounded-xl border border-yellow-700/40 bg-gradient-to-b from-yellow-900/20 to-gray-900/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 p-3 text-left text-yellow-300 hover:bg-yellow-900/20 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium text-sm">工具调用: {toolName}</span>
          {resultMessage ? (
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${isError ? "bg-red-900/40 text-red-300" : "bg-emerald-900/40 text-emerald-300"}`}>
              {isError ? "执行失败" : "已完成"}
            </span>
          ) : (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] bg-yellow-900/40 text-yellow-200">执行中</span>
          )}
          <svg className={`w-4 h-4 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="border-t border-yellow-700/30 divide-y divide-gray-800/80">
            {toolArguments && (
              <div className="p-3">
                <div className="mb-2 text-xs font-medium text-gray-400">调用参数</div>
                <pre className="text-xs bg-gray-950/70 p-3 rounded-lg overflow-x-auto text-gray-200">
                  <code>{JSON.stringify(toolArguments, null, 2)}</code>
                </pre>
              </div>
            )}

            {resultMessage && (
              <div className="p-3">
                <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                  <span>执行结果</span>
                  {truncated && (
                    <button
                      type="button"
                      onClick={() => setShowFull(!showFull)}
                      className="ml-auto text-blue-400 hover:text-blue-300"
                    >
                      {showFull ? "收起" : "展开完整输出"}
                    </button>
                  )}
                </div>
                <pre className={`text-xs overflow-x-auto rounded-lg p-3 bg-gray-950/70 ${isError ? "text-red-300" : "text-gray-300"}`}>
                  <code>{truncated && !showFull ? `${output.slice(0, 500)}\n... [输出已截断]` : output}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageBubble({ message, nextMessage, skip }) {
  if (skip) return null;

  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

  if (message.type === "tool_call" || toolCalls.length > 0) {
    const resultMessage = nextMessage && (nextMessage.type === "tool_result" || nextMessage.role === "tool")
      ? nextMessage
      : null;
    return <ToolMessageCard callMessage={message} resultMessage={resultMessage} />;
  }

  if (message.type === "tool_result" || message.role === "tool") {
    return <ToolMessageCard callMessage={{ name: "tool" }} resultMessage={message} compact />;
  }

  if (message.role === "user") {
    return (
      <div className="animate-fade-in">
        <div className="max-w-3xl mx-auto flex justify-end px-2">
          <div className="bg-blue-600 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 max-w-[85%] sm:max-w-[80%] break-words">
            <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  if (message.role === "assistant") {
    const html = marked.parse(message.content || "");
    return (
      <div className="animate-fade-in">
        <div className="max-w-3xl mx-auto px-2">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
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

  return (
    <div className="animate-fade-in">
      <div className="max-w-3xl mx-auto text-center text-gray-500 text-sm py-2">
        {message.content || JSON.stringify(message)}
      </div>
    </div>
  );
}
