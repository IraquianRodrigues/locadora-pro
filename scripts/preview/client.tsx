import { hydrateRoot } from "react-dom/client";
import { PreviewApp } from "./app";
hydrateRoot(
  document.getElementById("preview-root")!,
  <PreviewApp location={window.location.pathname + window.location.search} />,
);
