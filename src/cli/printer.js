import process from "process";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

const ANSI_RESET = "\x1b[0m";
const ANSI_CYAN = "\x1b[36m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_MAGENTA = "\x1b[35m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_GRAY = "\x1b[90m";
const ANSI_BOLD = "\x1b[1m";
const YOU_PREFIX = `${ANSI_CYAN}you${ANSI_RESET}`;
const ASSISTANT_PREFIX = `${ANSI_GREEN}assistant${ANSI_RESET}`;
const AGENT_PREFIX = `${ANSI_MAGENTA}agent${ANSI_RESET}`;
const TOOL_CALL_PREFIX = `${ANSI_MAGENTA}[tool call]${ANSI_RESET}`;
const TOOL_RESULT_PREFIX = `${ANSI_YELLOW}[tool result]${ANSI_RESET}`;

marked.use(markedTerminal({
  reflowText: true,
  width: 100
}));

const renderMarkdown = (text) => marked.parse(String(text ?? "")).trimEnd();

const truncateText = (text, maxChars = 200) => {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
};

const formatGray = (text) => `${ANSI_GRAY}${text}${ANSI_RESET}`;

const printLine = (prefix, content = "") => {
  process.stdout.write(`${prefix}${content ? ` ${content}` : ""}\n`);
};

const printBlock = (prefix, content = "") => {
  process.stdout.write(`${prefix}\n`);
  if (content) {
    process.stdout.write(`${content}\n`);
  }
};

const parseToolArgs = (toolCall) => {
  const raw = toolCall?.function?.arguments || "";
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const replaceThinkingWithReply = (text) => {
  process.stdout.write("\x1b[1A");
  process.stdout.write("\x1b[2K");
  process.stdout.write("\r");
  printBlock(ASSISTANT_PREFIX, renderMarkdown(text));
};

const clearThinking = () => {
  process.stdout.write("\x1b[1A");
  process.stdout.write("\x1b[2K");
  process.stdout.write("\r");
};

const showThinking = () => {
  printLine(ASSISTANT_PREFIX, "思考中...");
};

const createStreamPrinter = ({ onIdlePrompt } = {}) => {
  let thinkingVisible = false;
  let pendingResolve = null;
  let pendingReject = null;

  return {
    beginTurn() {
      thinkingVisible = true;
      showThinking();
      return new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
    },
    handle(event, data) {
      if (event === "connected" || event === "start") {
        return;
      }
      if (event === "tool_call") {
        if (thinkingVisible) {
          clearThinking();
          thinkingVisible = false;
        }
        const args = parseToolArgs(data?.toolCall);
        const reason = truncateText(args.reason || "");
        const command = truncateText(args.command || data?.toolCall?.function?.arguments || "");
        printLine(TOOL_CALL_PREFIX, reason ? `${ANSI_BOLD}${reason}${ANSI_RESET}` : "");
        if (command) {
          process.stdout.write(`${formatGray(command)}\n`);
        }
      }
      if (event === "tool_result") {
        if (thinkingVisible) {
          clearThinking();
          thinkingVisible = false;
        }
        const content = truncateText(data?.message?.content || "");
        printLine(TOOL_RESULT_PREFIX);
        process.stdout.write(`${formatGray(content)}\n`);
      }
      if (event === "done") {
        const text = data?.text || "";
        const hadPendingTurn = Boolean(pendingResolve);
        if (thinkingVisible) {
          replaceThinkingWithReply(text);
          thinkingVisible = false;
        } else {
          printLine(AGENT_PREFIX);
          printBlock(ASSISTANT_PREFIX, renderMarkdown(text));
        }
        pendingResolve?.(text);
        pendingResolve = null;
        pendingReject = null;
        if (!hadPendingTurn) {
          onIdlePrompt?.();
        }
      }
      if (event === "error") {
        const error = new Error(data?.error || "base stream error");
        const hadPendingTurn = Boolean(pendingReject);
        if (thinkingVisible) {
          clearThinking();
          thinkingVisible = false;
        }
        pendingReject?.(error);
        pendingResolve = null;
        pendingReject = null;
        if (!hadPendingTurn) {
          onIdlePrompt?.();
        }
      }
    }
  };
};

export { YOU_PREFIX, createStreamPrinter };
