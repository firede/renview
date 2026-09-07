import { RedisClient } from "bun";

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, seconds: number): Promise<void>;
  take<T>(key: string): Promise<T | null>;
  limit(key: string, maximum: number, seconds: number): Promise<boolean>;
}

/** Redis 仅保存可过期的缓存；服务故障时停止上游读取，避免击穿。 */
export class RedisCache implements Cache {
  private client: RedisClient;
  constructor(url: string) {
    this.client = new RedisClient(url, { connectionTimeout: 3000, maxRetries: 1 });
  }
  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(`rv:${key}`);
    return value === null ? null : JSON.parse(value);
  }
  async set(key: string, value: unknown, seconds: number) {
    await this.client.set(`rv:${key}`, JSON.stringify(value), "EX", seconds);
  }
  async take<T>(key: string): Promise<T | null> {
    const value = await this.client.send("GETDEL", [`rv:${key}`]);
    return value === null ? null : JSON.parse(String(value));
  }
  async limit(key: string, maximum: number, seconds: number) {
    const count = await this.client.send("EVAL", [
      "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
      "1",
      `rv:limit:${key}`,
      String(seconds),
    ]);
    return Number(count) <= maximum;
  }
}

/** 合并单机进程内相同资源的并发加载，不保留完成后的结果。 */
export class SingleFlight {
  private pending = new Map<string, Promise<unknown>>();
  run<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const result = Promise.resolve()
      .then(load)
      .finally(() => this.pending.delete(key));
    this.pending.set(key, result);
    return result;
  }
}

/** 有界等待队列；过载时立即拒绝，避免请求无限堆积。 */
export class Gate {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(
    private concurrency: number,
    private capacity = 32,
  ) {}
  async run<T>(load: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      if (this.waiting.length >= this.capacity) throw new Error("服务繁忙，请稍后重试");
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else this.active++;
    try {
      return await load();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}
