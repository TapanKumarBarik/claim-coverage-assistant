import { createContext, useContext } from "react";
import type { CatalogState } from "./useCatalogState";

export const CatalogContext = createContext<CatalogState | null>(null);

/** Shared state and actions of the catalogue tab (see `useCatalogState`). */
export function useCatalog(): CatalogState {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used inside <CatalogTab>");
  return context;
}
