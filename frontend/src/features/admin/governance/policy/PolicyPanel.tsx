import type { ReactNode } from "react";
import { useResource } from "../../../../hooks/useResource";
import { useI18n } from "../../../../i18n/useI18n";
import { AsyncView } from "../../../../shared/AsyncView";
import { Card } from "../../../../ui/Card";
import { useAdminApi } from "../../adminContext";
import "../governance.css";
import { GuardList } from "./GuardList";
import { LimitTable } from "./LimitTable";
import { SecretsPosture } from "./SecretsPosture";
import { SkillTable } from "./SkillTable";
import { TierTable } from "./TierTable";
import { ToolList } from "./ToolList";

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="policy-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

/** Read-only view of the rules the AI currently runs under. */
export function PolicyPanel() {
  const { t } = useI18n();
  const api = useAdminApi();
  const { state, reload } = useResource(api.governancePolicy, [api]);
  return (
    <Card title={t("gov.policy.title")}>
      <AsyncView state={state} onRetry={reload}>
        {(policy) => (
          <>
            <PolicySection title={t("gov.policy.tiers")}>
              <TierTable tiers={policy.tiers} />
            </PolicySection>
            <PolicySection title={t("gov.policy.skills")}>
              <SkillTable skills={policy.skills} />
            </PolicySection>
            <PolicySection title={t("gov.policy.toolsTitle")}>
              <ToolList tools={policy.tools} />
            </PolicySection>
            <PolicySection title={t("gov.policy.guards")}>
              <GuardList guards={policy.guards} />
            </PolicySection>
            <PolicySection title={t("gov.policy.limits")}>
              <LimitTable limits={policy.limits} />
            </PolicySection>
            <PolicySection title={t("gov.policy.secrets")}>
              <SecretsPosture secrets={policy.secrets} />
            </PolicySection>
          </>
        )}
      </AsyncView>
    </Card>
  );
}
