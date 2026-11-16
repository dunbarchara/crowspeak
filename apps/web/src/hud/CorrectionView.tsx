import type { CorrectionItem, Corrections } from '../engine/types';
import { segmentMessage } from '../lib/corrections';
import { WindowHeader } from './WindowHeader';

/**
 * The learner's text with the flagged stretches styled like links: red for errors, yellow for
 * suggestions. Clicking the message (not the words) opens the details, so these are plain marks.
 */
export function MarkedText({
  text,
  corrections,
}: {
  text: string;
  corrections: Corrections | null;
}) {
  if (!corrections) return <>{text}</>;
  return (
    <>
      {segmentMessage(text, corrections.items).map((segment, i) =>
        segment.item === null ? (
          <span key={i}>{segment.text}</span>
        ) : (
          <mark
            key={i}
            className="flag"
            data-severity={corrections.items[segment.item].severity}
          >
            {segment.text}
          </mark>
        ),
      )}
    </>
  );
}

function Item({ item }: { item: CorrectionItem }) {
  return (
    <li className="fix" data-severity={item.severity}>
      <span className="fix-change">
        <del>{item.original}</del> <ins>{item.suggestion}</ins>
      </span>
      <span className="fix-category">{item.category}</span>
      <span className="fix-why">{item.explanation}</span>
    </li>
  );
}

/** The details for one learner message: what to change, and why. Opens beside the chat. */
export function CorrectionsWindow({
  text,
  corrections,
  onClose,
}: {
  text: string;
  corrections: Corrections;
  onClose: () => void;
}) {
  return (
    <section className="window corrections-window" aria-label="Corrections">
      <WindowHeader
        title={`Corrections (${corrections.language})`}
        closeLabel="Close corrections"
        onClose={onClose}
      />
      <div className="corrections-body">
        <h3>Your message</h3>
        <p className="corrections-original">
          <MarkedText text={text} corrections={corrections} />
        </p>
        <h3>Better</h3>
        <p className="corrections-better">
          <ins>{corrections.corrected}</ins>
        </p>
        <h3>What to change</h3>
        <ul className="fixes">
          {corrections.items.map((item, i) => (
            <Item key={i} item={item} />
          ))}
        </ul>
        {corrections.more.length > 0 && (
          <details>
            <summary>{corrections.more.length} minor fixes</summary>
            <ul className="fixes">
              {corrections.more.map((item, i) => (
                <Item key={i} item={item} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
