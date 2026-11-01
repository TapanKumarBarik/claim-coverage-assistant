import type { FeedbackFilter } from "../../../api/types";
import { FEEDBACK_FILTERS } from "../../../constants/domain";
import { isOneOf } from "../../../constants/enumOf";
import { FEEDBACK_FILTER_LABEL } from "../../../constants/labels";
import { useI18n } from "../../../i18n/useI18n";
import { Field } from "../../../ui/Field";
import { Select } from "../../../ui/Select";
import { TextInput } from "../../../ui/TextInput";

/** Filter value meaning "any feedback". */
export const ANY_FEEDBACK = "all";
export type FeedbackFilterValue = FeedbackFilter | typeof ANY_FEEDBACK;

interface Props {
  feedback: FeedbackFilterValue;
  search: string;
  onFeedback: (value: FeedbackFilterValue) => void;
  onSearch: (value: string) => void;
}

/** Narrow the table to liked, disliked or unrated conversations, and to those that mention some text. */
export function ConversationFilters({ feedback, search, onFeedback, onSearch }: Props) {
  const { t } = useI18n();
  return (
    <div className="conversation-filters">
      <Field label={t("conv.filter.label")} narrow>
        <Select value={feedback} onChange={(event) => onFeedback(isOneOf(FEEDBACK_FILTERS, event.target.value) ? event.target.value : ANY_FEEDBACK)}>
          <option value={ANY_FEEDBACK}>{t("conv.filter.all")}</option>
          {FEEDBACK_FILTERS.map((value) => (
            <option key={value} value={value}>
              {t(FEEDBACK_FILTER_LABEL[value])}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("conv.search.label")}>
        <TextInput type="search" value={search} placeholder={t("conv.search.placeholder")} onChange={(event) => onSearch(event.target.value)} />
      </Field>
    </div>
  );
}
