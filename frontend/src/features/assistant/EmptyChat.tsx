import { useId } from "react";
import type { ContractPublic, Example } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { Disclosure } from "../../ui/Disclosure";
import { BrandMark } from "../../ui/BrandMark";
import { DocumentList } from "./DocumentList";
import { ExamplePicker } from "./ExamplePicker";

interface Props {
  examples: readonly Example[];
  /** The contract currently chosen in the composer, whose documents are listed. */
  contract: ContractPublic | undefined;
  onPick: (example: Example) => void;
}

/** What the chat shows before the first question: what it is for, things to try, and what it will read. */
export function EmptyChat({ examples, contract, onPick }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <section className="empty-chat" aria-labelledby={titleId}>
      <BrandMark size="large" />
      <h2 id={titleId}>{t("chat.emptyTitle")}</h2>
      <p className="muted">{t("chat.emptyBody")}</p>
      <ExamplePicker examples={examples} onPick={onPick} />
      {contract && (
        <Disclosure summary={t("form.docs")} className="empty-chat__docs">
          <DocumentList contract={contract} />
        </Disclosure>
      )}
    </section>
  );
}
