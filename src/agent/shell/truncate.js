export const DEFAULT_MAX_OUTPUT_CHARS = 20000;
export const MIN_MAX_OUTPUT_CHARS = 1000;
export const MAX_MAX_OUTPUT_CHARS = 200000;

export const normalizeMaxOutputChars = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_MAX_OUTPUT_CHARS;
  return Math.max(MIN_MAX_OUTPUT_CHARS, Math.min(MAX_MAX_OUTPUT_CHARS, Math.floor(num)));
};

export const truncateOutput = (content, maxChars = DEFAULT_MAX_OUTPUT_CHARS) => {
  const text = String(content ?? '');
  const limit = normalizeMaxOutputChars(maxChars);
  if (text.length <= limit) {
    return {
      content: text,
      truncated: false,
      omittedChars: 0,
    };
  }

  const head = Math.floor(limit * 0.6);
  const tail = limit - head;
  const omittedChars = text.length - limit;

  return {
    content: `${text.slice(0, head)}\n...[truncated ${omittedChars} chars]...\n${text.slice(-tail)}`,
    truncated: true,
    omittedChars,
  };
};
