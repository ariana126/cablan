import { afterEach, describe, expect, it, vi } from 'vitest';

import { newSubmissionId } from './submission-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newSubmissionId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws a random UUID', () => {
    expect(newSubmissionId()).toMatch(UUID_V4);
  });

  it('draws a different one every time', () => {
    expect(newSubmissionId()).not.toBe(newSubmissionId());
  });

  it('still draws one where the page is not a secure context and `randomUUID` is missing', () => {
    const { getRandomValues } = crypto;
    vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(crypto) });

    expect(newSubmissionId()).toMatch(UUID_V4);
  });
});
