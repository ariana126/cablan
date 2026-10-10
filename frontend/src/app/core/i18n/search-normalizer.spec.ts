import { describe, expect, it } from 'vitest';

import { matchesSearch, normalizeForSearch } from './search-normalizer';

describe('matchesSearch', () => {
  it('ignores Latin case', () => {
    expect(matchesSearch('Ariana', 'ar')).toBe(true);
    expect(matchesSearch('ariana', 'AR')).toBe(true);
  });

  it('matches anywhere in the text, not only the start', () => {
    expect(matchesSearch('Ariana', 'ian')).toBe(true);
    expect(matchesSearch('Yashar', 'ar')).toBe(true);
    expect(matchesSearch('Yashar', 'ari')).toBe(false);
  });

  it('treats an empty or blank query as matching everything', () => {
    expect(matchesSearch('Ariana', '')).toBe(true);
    expect(matchesSearch('Ariana', '   ')).toBe(true);
  });

  it('treats Arabic and Persian yeh and kaf as the same letter', () => {
    expect(matchesSearch('کیان', 'كيان')).toBe(true);
    expect(matchesSearch('كيان', 'کیان')).toBe(true);
  });

  it('treats Persian, Arabic-Indic and Latin digits as the same number', () => {
    expect(matchesSearch('MI-123', '۱۲۳')).toBe(true);
    expect(matchesSearch('کد ۱۲۳', '١٢٣')).toBe(true);
    expect(matchesSearch('کد ۱۲۳', '123')).toBe(true);
  });

  it('ignores zero-width non-joiners, diacritics and tatweel', () => {
    expect(matchesSearch('می‌شود', 'میشود')).toBe(true);
    expect(matchesSearch('محمّد', 'محمد')).toBe(true);
    expect(matchesSearch('محمـد', 'محمد')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(matchesSearch('لگراند', 'نگزنس')).toBe(false);
  });
});

describe('normalizeForSearch', () => {
  it('trims and folds in one pass', () => {
    expect(normalizeForSearch('  ٱ كتاب ۱ ')).toBe('ٱ کتاب 1');
  });
});
