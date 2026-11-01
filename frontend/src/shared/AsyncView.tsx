import type { ReactNode } from "react";
import { ASYNC_STATUS } from "../constants/async";
import type { ResourceState } from "../hooks/useResource";
import { useI18n } from "../i18n/useI18n";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { ErrorAlert } from "./ErrorAlert";

interface Props<T> {
  state: ResourceState<T>;
  /** Rendered once the data has arrived and is not empty. */
  children: (data: T) => ReactNode;
  /** Text shown while loading. */
  loadingLabel?: string;
  /** When given, data for which this returns true is replaced by `emptyLabel`. */
  isEmpty?: (data: T) => boolean;
  emptyLabel?: string;
  /** Overrides the generated error message. */
  errorMessage?: string;
  /** Adds a "Try again" button to the error state. */
  onRetry?: () => void;
}

/** The three states every async view needs (loading, error, empty), written once. */
export function AsyncView<T>({ state, children, loadingLabel, isEmpty, emptyLabel, errorMessage, onRetry }: Props<T>) {
  const { t } = useI18n();
  switch (state.status) {
    case ASYNC_STATUS.LOADING:
      return <Spinner label={loadingLabel ?? t("common.loading")} />;
    case ASYNC_STATUS.ERROR:
      return (
        <div className="stack">
          <ErrorAlert error={state.error} message={errorMessage} />
          {onRetry && (
            <div>
              <Button onClick={onRetry}>{t("common.retry")}</Button>
            </div>
          )}
        </div>
      );
    case ASYNC_STATUS.READY:
      return isEmpty?.(state.data) ? <EmptyState>{emptyLabel ?? t("common.noData")}</EmptyState> : <>{children(state.data)}</>;
  }
}
