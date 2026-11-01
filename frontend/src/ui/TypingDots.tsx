import "./TypingDots.css";

/** "The assistant is working": three pulsing dots and a label that screen readers announce politely. */
export function TypingDots({ label }: { label: string }) {
  return (
    <div role="status" className="typing">
      <span className="typing__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </div>
  );
}
