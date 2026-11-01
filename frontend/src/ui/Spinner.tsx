import "./Spinner.css";

/** A loading indicator whose text is announced politely by screen readers. */
export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="spinner">
      <span className="spinner__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
