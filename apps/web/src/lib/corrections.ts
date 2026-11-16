import type { CorrectionItem } from '../engine/types';

export interface Segment {
  text: string;
  /** Index into the items passed in, when this stretch of the message is a flagged span. */
  item: number | null;
}

/**
 * Split a learner's message into plain and flagged stretches, using each item's character
 * span. Items without a span, or with a span that is out of range or overlaps an earlier
 * flagged stretch, are left out (they still show in the correction list).
 */
export function segmentMessage(
  text: string,
  items: readonly CorrectionItem[],
): Segment[] {
  const spans = items
    .map((item, index) => ({ index, span: item.span }))
    .filter(
      (s): s is { index: number; span: { start: number; end: number } } =>
        s.span !== null &&
        s.span.start >= 0 &&
        s.span.end > s.span.start &&
        s.span.end <= text.length,
    )
    .sort((a, b) => a.span.start - b.span.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const { index, span } of spans) {
    if (span.start < cursor) continue; // overlaps the previous flagged stretch
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start), item: null });
    }
    segments.push({ text: text.slice(span.start, span.end), item: index });
    cursor = span.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), item: null });
  }
  return segments;
}
