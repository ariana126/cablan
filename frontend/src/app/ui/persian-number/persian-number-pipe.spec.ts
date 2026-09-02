import { describe, expect, it } from 'vitest';

import { PersianNumberPipe } from './persian-number-pipe';

describe('PersianNumberPipe', () => {
  const pipe = new PersianNumberPipe();

  it('renders a quantity in Persian digits', () => {
    expect(pipe.transform(1234.5)).toBe('۱٬۲۳۴٫۵');
  });

  it('renders zero, which is a real weight and not a missing one', () => {
    expect(pipe.transform(0)).toBe('۰');
  });

  it('renders nothing for a missing value, rather than the word null', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
