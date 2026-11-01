import type { DocumentVersion } from "../../../api/types";
import { VERSION_STATUS } from "../../../constants/domain";
import type { MessageKey } from "../../../i18n/messages";
import { useI18n } from "../../../i18n/useI18n";
import { Button, type ButtonVariant } from "../../../ui/Button";
import { CATALOG_ACTION } from "./catalogActions";
import { useCatalog } from "./CatalogContext";
import type { CatalogState } from "./useCatalogState";

interface ActionSpec {
  label: MessageKey;
  variant?: ButtonVariant;
  /** Buttons that change data are disabled while another change is in flight. */
  changesData: boolean;
  visible: (version: DocumentVersion) => boolean;
  perform: (catalog: CatalogState, version: DocumentVersion) => void;
}

const isLive = (version: DocumentVersion) => version.status === VERSION_STATUS.LIVE;

const ACTIONS: readonly ActionSpec[] = [
  { label: "action.preview", changesData: false, visible: () => true, perform: (c, v) => void c.openPreview(v) },
  {
    label: "action.activate",
    changesData: true,
    visible: (v) => !isLive(v),
    perform: (c, v) => c.requestConfirm(CATALOG_ACTION.ACTIVATE, v),
  },
  {
    label: "action.withdraw",
    changesData: true,
    visible: isLive,
    perform: (c, v) => c.requestConfirm(CATALOG_ACTION.WITHDRAW, v),
  },
  {
    label: "action.reindex",
    changesData: true,
    visible: (v) => !v.has_embeddings,
    perform: (c, v) => void c.run(() => c.api.reindex(v.id)),
  },
  {
    label: "action.delete",
    variant: "dangerOutline",
    changesData: true,
    visible: (v) => !isLive(v),
    perform: (c, v) => c.requestConfirm(CATALOG_ACTION.DELETE, v),
  },
];

/** The buttons that apply to one version, depending on its status and index. */
export function VersionActions({ version }: { version: DocumentVersion }) {
  const { t } = useI18n();
  const catalog = useCatalog();
  return (
    <div className="row row--wrap">
      {ACTIONS.filter((action) => action.visible(version)).map((action) => (
        <Button
          key={action.label}
          small
          variant={action.variant}
          aria-label={t("action.named", { action: t(action.label), label: version.label })}
          disabled={action.changesData && catalog.working}
          onClick={() => action.perform(catalog, version)}
        >
          {t(action.label)}
        </Button>
      ))}
    </div>
  );
}
