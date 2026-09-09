import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary, ConnectionStatus } from "./components/AppSafety";
import { uiAlert } from "./utils/dialog";
import "./styles.css";
import "./enhancements.css";
import "./refinements.css";
import "./enterprise.css";
import "./product-suite.css";
import "./chat-pro.css";
import "./google-chat-theme.css";
import "./ticketera.css";
import "./systems-kanban.css";
import "./notifications-center.css";
import "./projects-center.css";
import "./requirements-center.css";

const syncVisualViewport = () => {
  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  const offsetTop = viewport?.offsetTop ?? 0;
  document.documentElement.style.setProperty("--app-visual-height", `${Math.round(height)}px`);
  document.documentElement.style.setProperty("--app-visual-offset-top", `${Math.round(offsetTop)}px`);
};
syncVisualViewport();
window.addEventListener("resize", syncVisualViewport, { passive: true });
window.addEventListener("orientationchange", syncVisualViewport, { passive: true });
window.visualViewport?.addEventListener("resize", syncVisualViewport, { passive: true });
window.visualViewport?.addEventListener("scroll", syncVisualViewport, { passive: true });

window.alert = (message?: any) => {
  void uiAlert("EJB MANAGER", String(message ?? ""));
};
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ConnectionStatus />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
