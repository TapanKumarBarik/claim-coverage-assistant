import { useState } from "react";
import { CONVERSATIONS_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "../../../constants/limits";
import { useDebounced } from "../../../hooks/useDebounced";
import { useResource } from "../../../hooks/useResource";
import { useI18n } from "../../../i18n/useI18n";
import { AsyncView } from "../../../shared/AsyncView";
import { Card } from "../../../ui/Card";
import { DataTable } from "../../../ui/DataTable";
import { Pagination } from "../../../ui/Pagination";
import { useAdminApi } from "../adminContext";
import { ANY_FEEDBACK, ConversationFilters, type FeedbackFilterValue } from "./ConversationFilters";
import { FeedbackStats } from "./FeedbackStats";
import { useConversationColumns } from "./useConversationColumns";
import "./conversations.css";

/** Every saved conversation, newest first, with the feedback totals above and filters and paging around the table. */
export function ConversationList({ onOpen }: { onOpen: (requestId: string) => void }) {
  const { t } = useI18n();
  const api = useAdminApi();
  const columns = useConversationColumns(onOpen);
  const [feedback, setFeedback] = useState<FeedbackFilterValue>(ANY_FEEDBACK);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const text = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const filtered = feedback !== ANY_FEEDBACK || text !== "";

  const { state, reload } = useResource(
    () =>
      api.conversations({
        feedback: feedback === ANY_FEEDBACK ? undefined : feedback,
        text,
        offset,
        limit: CONVERSATIONS_PAGE_SIZE,
      }),
    [api, feedback, text, offset],
  );

  return (
    <div className="stack">
      <p className="muted conversations__privacy">{t("conv.privacy")}</p>
      <Card title={t("conv.stats.title")}>
        <FeedbackStats />
      </Card>
      <Card title={t("conv.title")}>
        <ConversationFilters
          feedback={feedback}
          search={search}
          onFeedback={(value) => {
            setFeedback(value);
            setOffset(0);
          }}
          onSearch={(value) => {
            setSearch(value);
            setOffset(0);
          }}
        />
        <AsyncView
          state={state}
          onRetry={reload}
          isEmpty={(page) => page.items.length === 0}
          emptyLabel={filtered ? t("conv.emptyFiltered") : t("conv.empty")}
        >
          {(page) => (
            <>
              <DataTable caption={t("conv.title")} columns={columns} rows={page.items} rowKey={(row) => row.request_id} />
              <Pagination total={page.total} offset={page.offset} limit={page.limit} onChange={setOffset} />
            </>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
