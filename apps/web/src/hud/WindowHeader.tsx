/** The strip across the top of a docked window: what it is, and a way to close it. */
export function WindowHeader({
  title,
  closeLabel,
  onClose,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <header className="window-head">
      <h2 className="window-title" title={title}>
        {title}
      </h2>
      <button
        type="button"
        className="window-close"
        aria-label={closeLabel}
        onClick={onClose}
      >
        ×
      </button>
    </header>
  );
}
