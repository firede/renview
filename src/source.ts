/** 全文读取上限独立于语法分析上限；超限不返回截断的伪源码。 */
export const MAX_SOURCE_BYTES = 2_000_000;

export class SourceTooLargeError extends Error {
  constructor() {
    super("文件过大");
  }
}

/** 流式计数，兼顾读取中增长的文件和 Git 输出；超限立即取消。 */
export async function readSourceStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SOURCE_BYTES) throw new SourceTooLargeError();
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readSourceFile(path: string): Promise<string> {
  const file = Bun.file(path);
  if (file.size > MAX_SOURCE_BYTES) throw new SourceTooLargeError();
  return readSourceStream(file.stream());
}
