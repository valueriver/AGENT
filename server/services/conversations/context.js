import { listAnchorsBefore } from "../../repository/anchors/index.js";
import { getConversation } from "../../repository/conversations/index.js";

const buildConversationContext = (conversationId, contextMessages) => {
  const conv = getConversation(conversationId);
  if (!conv) return "";
  const boundaryId = contextMessages
    .map((m) => m._id)
    .filter((id) => Number.isFinite(id))
    .reduce((min, id) => (min === null || id < min ? id : min), null);
  const outOfContextAnchors = boundaryId
    ? listAnchorsBefore(conversationId, boundaryId, 30)
    : [];

  const lines = ["<conversation>"];
  lines.push(`title: ${conv.title || ""}`);
  lines.push(`summary: ${conv.summary || ""}`);
  if (outOfContextAnchors.length) {
    lines.push("");
    lines.push(`anchors (out of context window, newest-first, up to 30):`);
    for (const a of outOfContextAnchors) {
      lines.push(`- [#${a.id}] ${a.anchor}`);
    }
  }
  lines.push("</conversation>");
  return lines.join("\n");
};

export { buildConversationContext };
