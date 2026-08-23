import { createContext, useContext } from "react";
import type { PortalManifest } from "./portalTypes";

export const PortalManifestContext = createContext<PortalManifest | null>(null);
export const usePortalManifest = () => useContext(PortalManifestContext);
