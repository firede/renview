/** 请求状态携带资源身份，切换路径后即使 effect 尚未执行也不会展示旧正文。 */
export interface ResourceState<T> {
  url: string | null;
  data: T | null;
  loading: boolean;
  error: string | null;
  unreachable: boolean;
}

export function emptyResource<T>(url: string | null): ResourceState<T> {
  return { url, data: null, loading: url != null, error: null, unreachable: false };
}

/** 每个资源只有最新请求可以发布结果；取消同时覆盖 fetch 和已进入 JSON 解析的请求。 */
export function createResourceLoader<T>(publish: (state: ResourceState<T>) => void) {
  let controller: AbortController | null = null;
  let state = emptyResource<T>(null);
  const update = (next: ResourceState<T>) => {
    state = next;
    publish(next);
  };
  return {
    cancel() { controller?.abort(); },
    async load(url: string) {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      update({ ...(state.url === url ? state : emptyResource<T>(url)), loading: true, error: null });
      let unreachable = true;
      try {
        const response = await fetch(url, { signal: current.signal });
        unreachable = false;
        const data = await response.json() as T & { ok?: boolean; error?: string };
        if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
        if (!current.signal.aborted) update({ url, data, loading: false, error: null, unreachable: false });
      } catch (error) {
        if (!current.signal.aborted) update({
          url, data: null, loading: false,
          error: error instanceof Error ? error.message : String(error), unreachable,
        });
      }
    },
  };
}
