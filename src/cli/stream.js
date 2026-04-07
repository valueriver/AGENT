const startBaseStream = async (config, base, printer) => {
  const res = await fetch(`${config.serverUrl}/base/stream?baseDir=${encodeURIComponent(base.baseDir)}`);
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(text || `Server ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep >= 0) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
        const lines = chunk.split("\n");
        const eventLine = lines.find((line) => line.startsWith("event:"));
        const dataLines = lines.filter((line) => line.startsWith("data:"));
        if (!eventLine || dataLines.length === 0) continue;
        const event = eventLine.slice(6).trim();
        const data = JSON.parse(dataLines.map((line) => line.slice(5).trim()).join("\n"));
        printer.handle(event, data);
      }
    }
  })().catch((error) => {
    printer.handle("error", { error: error.message });
  });
};

export { startBaseStream };
