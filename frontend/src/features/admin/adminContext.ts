import { createContext, useContext } from "react";
import type { AdminApi } from "../../api/admin";

/** The signed-in admin API, available to every admin component without passing it down. */
export const AdminApiContext = createContext<AdminApi | null>(null);

export function useAdminApi(): AdminApi {
  const api = useContext(AdminApiContext);
  if (!api) throw new Error("useAdminApi must be used inside a signed-in admin area");
  return api;
}
