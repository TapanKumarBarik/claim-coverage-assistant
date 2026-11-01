import { EM_DASH } from "../constants/glyphs";

/** "Insurer — Product", used wherever a contract is named. */
export function contractName(contract: { insurer: string; product: string }): string {
  return `${contract.insurer} ${EM_DASH} ${contract.product}`;
}
