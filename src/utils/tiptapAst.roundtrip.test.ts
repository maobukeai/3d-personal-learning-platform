import { describe, it, expect } from 'vitest';
import { verifyRoundTrip } from './tiptapAst';

describe('tiptapAst.roundtrip', () => {
  it('passes a basic roundtrip', () => {
    const res = verifyRoundTrip('hello');
    expect(res.ok).toBe(true);
  });
});
