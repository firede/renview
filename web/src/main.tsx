import { Tooltip } from "@base-ui-components/react/tooltip";
import { createRoot } from "react-dom/client";
import "react-diff-view/style/index.css";
import "./app.css";
import { App } from "./App";
import { applyUiConfig, fetchUiConfig } from "./config";

async function bootstrap() {
  // 先应用配置再渲染，避免字体/字号闪跳
  applyUiConfig(await fetchUiConfig());
  createRoot(document.getElementById("root")!).render(
    // 擦除披露浮层的全局 Provider：扫过连续标记时即时切换（timeout 内免 delay）
    <Tooltip.Provider delay={150}>
      <App />
    </Tooltip.Provider>,
  );
  // 与 diff 数据同一刷新模型：窗口聚焦时重拉（改配置无需重启 CLI）
  window.addEventListener("focus", () => {
    void fetchUiConfig().then(applyUiConfig);
  });
}

void bootstrap();
