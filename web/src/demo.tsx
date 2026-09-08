import { createRoot } from "react-dom/client";
import { Tooltip } from "@base-ui-components/react/tooltip";
import "react-diff-view/style/index.css";
import "./app.css";
import { App } from "./App";
import { ViewerSourceContext, type ViewerSource } from "./viewerSource";
import { setLocale } from "./i18n";
import { setThemeSetting } from "./theme";

const locale = document.documentElement.lang === "zh-CN" ? "zh-CN" : "en";
setLocale(locale);
setThemeSetting("auto");
const source: ViewerSource = {
  refreshOnFocus: false,
  allowBrowse: false,
  allowRefresh: false,
  header: <span className="repo">samples/demo</span>,
  url(endpoint, parameters) {
    const base = `/demo/data/${locale}`;
    if (endpoint === "diff") return `${base}/diff.json`;
    if (endpoint === "review-file" && parameters?.path)
      return `${base}/review/${parameters.path.split("/").map(encodeURIComponent).join("/")}.json`;
    throw new Error(`演示不支持的接口：${endpoint}`);
  },
};
createRoot(document.getElementById("root")!).render(
  <ViewerSourceContext.Provider value={source}>
    <Tooltip.Provider delay={150}>
      <App />
    </Tooltip.Provider>
  </ViewerSourceContext.Provider>,
);
