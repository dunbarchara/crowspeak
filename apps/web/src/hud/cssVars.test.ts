import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPx } from './cssVars';

const withValue = (value: string) =>
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: () => value,
  }));
const element = {} as Element;

afterEach(() => vi.unstubAllGlobals());

describe('readPx', () => {
  it('reads a px custom property, ignoring whitespace', () => {
    withValue(' 24px ');
    expect(readPx(element, '--chat-margin', 16)).toBe(24);
  });

  it('accepts a fractional value', () => {
    withValue('12.5px');
    expect(readPx(element, '--chat-fade', 16)).toBe(12.5);
  });

  it('falls back when the property is missing or not in px', () => {
    for (const value of ['', '2rem', '50%', 'auto']) {
      withValue(value);
      expect(readPx(element, '--chat-margin', 16)).toBe(16);
    }
  });
});
