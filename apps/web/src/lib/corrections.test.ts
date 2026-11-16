import { describe, expect, it } from 'vitest';
import type { CorrectionItem } from '../engine/types';
import { segmentMessage } from './corrections';

const item = (span: CorrectionItem['span']): CorrectionItem => ({
  original: '',
  suggestion: '',
  category: 'grammar',
  severity: 'error',
  explanation: '',
  explanationLanguage: 'en',
  span,
  confidence: null,
});

describe('segmentMessage', () => {
  it('returns the whole text when there is nothing to flag', () => {
    expect(segmentMessage('hola', [])).toEqual([{ text: 'hola', item: null }]);
  });

  it('splits around a flagged span', () => {
    expect(
      segmentMessage('yo soy bien hoy', [item({ start: 3, end: 11 })]),
    ).toEqual([
      { text: 'yo ', item: null },
      { text: 'soy bien', item: 0 },
      { text: ' hoy', item: null },
    ]);
  });

  it('handles spans at the edges and several spans in any order', () => {
    const segments = segmentMessage('abcdef', [
      item({ start: 4, end: 6 }),
      item({ start: 0, end: 2 }),
    ]);
    expect(segments).toEqual([
      { text: 'ab', item: 1 },
      { text: 'cd', item: null },
      { text: 'ef', item: 0 },
    ]);
  });

  it('skips items with no span, a bad span or an overlapping span', () => {
    const segments = segmentMessage('abcdef', [
      item(null),
      item({ start: 4, end: 99 }),
      item({ start: 3, end: 3 }),
      item({ start: 1, end: 4 }),
      item({ start: 3, end: 5 }), // overlaps the earlier one
    ]);
    expect(segments).toEqual([
      { text: 'a', item: null },
      { text: 'bcd', item: 3 },
      { text: 'ef', item: null },
    ]);
  });

  it('reassembles to the original text', () => {
    const text = 'cómo estas amigo';
    const joined = segmentMessage(text, [item({ start: 5, end: 10 })])
      .map((s) => s.text)
      .join('');
    expect(joined).toBe(text);
  });
});
