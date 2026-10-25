import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.scss";
import App from "./App.tsx";

// Clean old bookmarks without reloading or losing the selected development player.
const url = new URL(window.location.href);
if (url.searchParams.has("view")) {
  url.searchParams.delete("view");
  window.history.replaceState(window.history.state, "", url);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
