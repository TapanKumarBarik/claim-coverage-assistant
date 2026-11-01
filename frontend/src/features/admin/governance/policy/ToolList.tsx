import type { ToolPolicy } from "../../../../api/types";
import { TOOL_LABEL } from "../../../../constants/labels";
import { useI18n } from "../../../../i18n/useI18n";
import "../governance.css";

/** Tools the model may call. The descriptions are written by the server and are not translated. */
export function ToolList({ tools }: { tools: readonly ToolPolicy[] }) {
  const { t } = useI18n();
  return (
    <ul className="policy-list">
      {tools.map((tool) => (
        <li key={tool.name}>
          <strong>{t(TOOL_LABEL[tool.name])}</strong>
          <code className="muted">{tool.name}</code>
          <span>{tool.description}</span>
        </li>
      ))}
    </ul>
  );
}
