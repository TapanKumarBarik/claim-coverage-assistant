import { publicApi } from "../../api/public";
import type { ContractPublic, Example } from "../../api/types";
import { useResource } from "../../hooks/useResource";

export interface ReferenceData {
  contracts: ContractPublic[];
  examples: Example[];
}

/** The contracts a claim can be checked against, and the example claims for them. */
export function useContracts() {
  return useResource<ReferenceData>(async () => {
    const [contracts, examples] = await Promise.all([publicApi.contracts(), publicApi.examples()]);
    return { contracts, examples };
  }, []);
}
