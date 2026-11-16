import { afterEach, describe, expect, it, vi } from 'vitest';
import { readColor, readPx } from './cssVars';

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

describe('readColor', () => {
  it('reads #rrggbb and #rgb as numbers', () => {
    withValue(' #f2f2f2 ');
    expect(readColor(element, '--bg-2', 0)).toBe(0xf2f2f2);
    withValue('#fa0');
    expect(readColor(element, '--bg-2', 0)).toBe(0xffaa00);
  });

  it('falls back for anything else, such as rgba()', () => {
    for (const value of ['', 'rgba(0, 0, 0, 0.5)', 'red', '#12345']) {
      withValue(value);
      expect(readColor(element, '--bg', 0x123456)).toBe(0x123456);
    }
  });
});
