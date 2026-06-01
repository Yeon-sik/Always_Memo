import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./index.css";

// React 앱 진입점. Tauri 웹뷰와 Vite dev 서버 모두 같은 루트 컴포넌트를 렌더링한다.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
