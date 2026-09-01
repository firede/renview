import { createRoot } from "react-dom/client";
import "react-diff-view/style/index.css";
import "./app.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
