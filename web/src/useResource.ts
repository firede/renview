import { useCallback, useEffect, useMemo, useState } from "react";
import { createResourceLoader, emptyResource } from "./resource";

/** 首次进入与窗口聚焦时刷新；URL 变化和卸载都会取消旧请求。 */
export function useResource<T>(url: string | null, refreshOnFocus = true) {
  const [state, setState] = useState(() => emptyResource<T>(url));
  const loader = useMemo(() => createResourceLoader<T>(setState), []);
  const refresh = useCallback(() => {
    if (url) void loader.load(url);
  }, [loader, url]);
  useEffect(() => {
    refresh();
    if (refreshOnFocus) window.addEventListener("focus", refresh);
    return () => {
      loader.cancel();
      window.removeEventListener("focus", refresh);
    };
  }, [loader, refresh, refreshOnFocus]);
  return { ...(state.url === url ? state : emptyResource<T>(url)), refresh };
}
