let activeConversationId = "";

const setActiveConversationId = (conversationId) => {
  activeConversationId = String(conversationId || "").trim();
};

const getActiveConversationId = () => activeConversationId;

const normalizeConversationId = (conversationId) => {
  const value = String(conversationId || "").trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(`invalid conversationId: ${conversationId}`);
  }
  return value;
};

export { getActiveConversationId, normalizeConversationId, setActiveConversationId };
