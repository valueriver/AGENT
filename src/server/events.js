const conversationSubscribers = new Map();

const subscribeConversation = (conversationId, res) => {
  const key = String(conversationId);
  const set = conversationSubscribers.get(key) || new Set();
  set.add(res);
  conversationSubscribers.set(key, set);
};

const unsubscribeConversation = (conversationId, res) => {
  const key = String(conversationId);
  const set = conversationSubscribers.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    conversationSubscribers.delete(key);
  }
};

const emitConversationEvent = (conversationId, sendSse, event, payload) => {
  const set = conversationSubscribers.get(String(conversationId));
  if (!set) return;
  for (const res of set) {
    sendSse(res, event, payload);
  }
};

export { emitConversationEvent, subscribeConversation, unsubscribeConversation };
