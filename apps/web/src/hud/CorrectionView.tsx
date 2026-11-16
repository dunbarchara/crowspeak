import type { CorrectionItem, Corrections } from '../engine/types';
import { segmentMessage } from '../lib/corrections';

/** The learner's text with flagged stretches underlined: red for errors, yellow for suggestions. */
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

/** Feedback under a learner message: praise when it is right, otherwise the fixes. */
export function CorrectionView({ corrections }: { corrections: Corrections }) {
  if (corrections.isCorrect) {
    return corrections.praise ? (
      <p className="praise">{corrections.praise}</p>
    ) : null;
  }
  return (
    <div className="corrections">
      <p className="corrected">
        <ins>{corrections.corrected}</ins>
      </p>
      <ul>
        {corrections.items.map((item, i) => (
          <Item key={i} item={item} />
        ))}
      </ul>
      {corrections.more.length > 0 && (
        <details>
          <summary>{corrections.more.length} minor fixes</summary>
          <ul>
            {corrections.more.map((item, i) => (
              <Item key={i} item={item} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
