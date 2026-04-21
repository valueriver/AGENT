import { parseJson } from "../../utils.js";
import {
  normalizeConversationId,
  runConversationChat,
} from "../../services/conversations.js";

const handleChatPost = async (req, res, { openSse, readBody, sendSse }) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.chat.body");
  const conversationId = normalizeConversationId(body.conversationId);

  openSse(res);
  sendSse(res, "connected", { ok: true, conversationId });

  const controller = new AbortController();
  req.on("close", () => {
    controller.abort();
  });

  try {
    await runConversationChat(conversationId, body, {
      signal: controller.signal,
      onEvent: (event) => {
        sendSse(res, event.type, event);
      },
    });
  } catch (error) {
    if (error?.name !== "AbortError") {
      sendSse(res, "error", {
        ok: false,
        conversationId,
        error: error.message,
      });
    }
  } finally {
    res.end();
  }
};

export { handleChatPost };
