import { createContext, useContext, type ReactNode } from "react";

/** 应用入口提供数据位置，查看器不依赖本地 Git 或在线身份系统。 */
export interface ViewerSource {
  url: (endpoint: string, parameters?: Record<string, string>) => string;
  refreshOnFocus: boolean;
  header?: ReactNode;
  headerStart?: ReactNode;
  headerActions?: ReactNode;
  allowBrowse?: boolean;
  allowRefresh?: boolean;
  errorActions?: ReactNode;
  onRefresh?: () => void;
}
const localSource: ViewerSource = {
  url: (endpoint, parameters) =>
    `/api/${endpoint}${parameters ? `?${new URLSearchParams(parameters)}` : ""}`,
  refreshOnFocus: true,
};
export const ViewerSourceContext = createContext<ViewerSource>(localSource);
export const useViewerSource = () => useContext(ViewerSourceContext);
