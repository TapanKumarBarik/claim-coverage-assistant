import type { AnalyzeRequest, ContractPublic } from "../../api/types";
import { MIDDLE_DOT } from "../../constants/glyphs";
import { useI18n } from "../../i18n/useI18n";
import { contractName } from "../../lib/contracts";
import { VisuallyHidden } from "../../ui/VisuallyHidden";

interface Props {
  request: AnalyzeRequest;
  contract: ContractPublic | undefined;
}

/** What the user asked, with the contract and loss date it was asked against, as a right-aligned bubble. */
export function UserMessage({ request, contract }: Props) {
  const { t, format } = useI18n();
  const context = [contract && contractName(contract), request.loss_date && format.date(request.loss_date)].filter(Boolean);
  return (
    <div className="message message--user">
      <VisuallyHidden>{t("chat.you")}</VisuallyHidden>
      <p className="bubble">{request.claim}</p>
      {context.length > 0 && <p className="message__meta muted small">{context.join(` ${MIDDLE_DOT} `)}</p>}
    </div>
  );
}
