import { reactive } from "vue";

export const conversationState = reactive({
  currentId: "",
  current: null,
});

export const setCurrentConversation = (id, conv = null) => {
  conversationState.currentId = id || "";
  conversationState.current = conv;
};

export const clearCurrentConversation = () => {
  conversationState.currentId = "";
  conversationState.current = null;
};
