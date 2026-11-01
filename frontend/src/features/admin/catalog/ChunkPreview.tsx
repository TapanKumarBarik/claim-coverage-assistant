import { MIDDLE_DOT, PINNED_GLYPH } from "../../../constants/glyphs";
import { useI18n } from "../../../i18n/useI18n";
import { Button } from "../../../ui/Button";
import type { ChunkPreviewData } from "./catalogActions";
import "./catalog.css";

interface Props {
  preview: ChunkPreviewData;
  onClose: () => void;
}

/** The passages a version was split into, so an admin can check the parser before activating it. */
export function ChunkPreview({ preview, onClose }: Props) {
  const { t } = useI18n();
  return (
    <div className="chunk-preview">
      <div className="row row--between">
        <h4>{t("preview.title", { label: preview.version.label })}</h4>
        <Button onClick={onClose}>{t("action.close")}</Button>
      </div>
      <ol>
        {preview.chunks.map((chunk) => (
          <li key={chunk.id}>
            <p className="label">
              {chunk.section} {MIDDLE_DOT} {t("evidence.page", { n: chunk.page })}
              {chunk.pinned && (
                <>
                  {` ${MIDDLE_DOT} `}
                  <span role="img" aria-label={t("preview.pinned")}>
                    {PINNED_GLYPH}
                  </span>
                </>
              )}
            </p>
            <p className="chunk-preview__text">{chunk.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
