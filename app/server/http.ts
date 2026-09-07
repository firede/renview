export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 读取上游响应前后都限制大小，不能依赖不一定存在的 Content-Length。 */
export async function boundedText(response: Response, maximum: number): Promise<string> {
  if (Number(response.headers.get("content-length")) > maximum) {
    await response.body?.cancel();
    throw new HttpError(413, "内容过大，请使用本地 renview 查看");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maximum) throw new HttpError(413, "内容过大，请使用本地 renview 查看");
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(parts).toString("utf8");
}
