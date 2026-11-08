import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.scss";


// Clean old bookmarks without reloading or losing the selected development player.
const url = new URL(window.location.href);
if (url.searchParams.has("view")) {
  url.searchParams.delete("view");
  window.history.replaceState(window.history.state, "", url);
}

const { default: App } = window.location.pathname.replace(/\/$/, "") === "/rules"
  ? await import("./features/rules/RulesPage")
  : await import("./App");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
