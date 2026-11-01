import { useState } from "react";
import type { AiEvent } from "../../../api/types";
import { EVENTS_LIMIT } from "../../../constants/limits";
import { useResource } from "../../../hooks/useResource";
import { useI18n } from "../../../i18n/useI18n";
import { AsyncView } from "../../../shared/AsyncView";
import { Card } from "../../../ui/Card";
import { DataTable } from "../../../ui/DataTable";
import { useAdminApi } from "../adminContext";
import { EventDetail } from "./EventDetail";
import { ALL_OUTCOMES, OutcomeFilter, type OutcomeFilterValue } from "./OutcomeFilter";
import { useEventColumns } from "./useEventColumns";

const eventKey = (event: AiEvent) => `${event.request_id}-${event.ts}`;

/** Newest AI requests, optionally narrowed to one outcome; one row opens to show the rest. Never shows claim text. */
export function EventsTable() {
  const { t } = useI18n();
  const api = useAdminApi();
  const [filter, setFilter] = useState<OutcomeFilterValue>(ALL_OUTCOMES);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const columns = useEventColumns({
    isOpen: (event) => eventKey(event) === openKey,
    toggle: (event) => setOpenKey((current) => (current === eventKey(event) ? null : eventKey(event))),
  });
  const { state, reload } = useResource(
    () => api.governanceEvents({ limit: EVENTS_LIMIT, outcome: filter === ALL_OUTCOMES ? undefined : filter }),
    [api, filter],
  );

  return (
    <Card title={t("gov.events.title")}>
      <OutcomeFilter value={filter} onChange={setFilter} />
      <AsyncView state={state} onRetry={reload} isEmpty={(events) => events.length === 0} emptyLabel={t("gov.events.empty")}>
        {(events) => (
          <DataTable
            caption={t("gov.events.title")}
            columns={columns}
            rows={events}
            rowKey={eventKey}
            detail={(event) => (eventKey(event) === openKey ? <EventDetail event={event} /> : null)}
          />
        )}
      </AsyncView>
    </Card>
  );
}
