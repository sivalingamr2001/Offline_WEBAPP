import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";
import { ModuleRegistry } from "ag-grid-community";
import { AllCommunityModule } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule])

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
