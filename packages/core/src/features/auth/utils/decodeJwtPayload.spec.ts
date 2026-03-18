import { describe, expect, it } from 'vitest';
import { decodeJwtPayload } from './decodeJwtPayload';

const toBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64url');

describe('decodeJwtPayload', () => {
  it('decodes payload from a valid JWT token', () => {
    const payload = { sub: 'user-1', email: 'demo@example.com' };
    const token = `header.${toBase64Url(JSON.stringify(payload))}.signature`;
    expect(decodeJwtPayload(token)).toEqual(payload);
  });

  it('returns null for invalid tokens', () => {
    expect(decodeJwtPayload('invalid-token')).toBeNull();
    expect(decodeJwtPayload('header.badpayload.signature')).toBeNull();
  });
});
