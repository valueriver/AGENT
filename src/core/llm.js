const buildHeaders = (apiKey, apiUrl) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };
  if (apiUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "agent-cli";
  }
  return headers;
};

const callLlm = async (apiUrl, apiKey, payload, { signal } = {}) => {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: buildHeaders(apiKey, apiUrl),
    body: JSON.stringify(payload),
    signal
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text}`);
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message;
  if (!message) {
    throw new Error("LLM response missing choices[0].message");
  }

  return {
    role: "assistant",
    content: message.content ?? "",
    tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : undefined
  };
};

export { callLlm };
