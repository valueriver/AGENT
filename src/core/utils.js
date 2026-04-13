const parseJson = (raw, label = "json") => {
  const input = String(raw ?? "");
  if (!input) {
    throw new Error(`Invalid JSON in ${label}: empty input`);
  }
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
};

const getLastAssistantMessage = (messages = []) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return messages[index];
    }
  }
  return null;
};

export { getLastAssistantMessage, parseJson };
