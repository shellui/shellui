import { describe, expect, it } from 'vitest';
import {
  AuthRequestError,
  getAuthRequestErrorCode,
  inferAccessPendingErrorCode,
  isAccessPendingErrorCode,
} from './authRequestError';

describe('isAccessPendingErrorCode', () => {
  it('recognizes pending and denied codes', () => {
    expect(isAccessPendingErrorCode('access_pending')).toBe(true);
    expect(isAccessPendingErrorCode('access_denied')).toBe(true);
    expect(isAccessPendingErrorCode('oauth_authorize_failed')).toBe(false);
    expect(isAccessPendingErrorCode(null)).toBe(false);
  });
});

describe('AuthRequestError', () => {
  it('stores optional error code', () => {
    const err = new AuthRequestError('Waiting for approval.', 'access_pending');
    expect(err.message).toBe('Waiting for approval.');
    expect(err.code).toBe('access_pending');
  });
});

describe('getAuthRequestErrorCode', () => {
  it('reads code from AuthRequestError and duck-typed objects', () => {
    expect(getAuthRequestErrorCode(new AuthRequestError('x', 'access_pending'))).toBe(
      'access_pending',
    );
    expect(getAuthRequestErrorCode({ name: 'AuthRequestError', code: 'access_denied' })).toBe(
      'access_denied',
    );
    expect(getAuthRequestErrorCode(new Error('nope'))).toBe(null);
  });
});

describe('inferAccessPendingErrorCode', () => {
  it('infers from known backend messages', () => {
    expect(
      inferAccessPendingErrorCode(
        'Your account was created and is waiting for an administrator to grant access.',
      ),
    ).toBe('access_pending');
    expect(
      inferAccessPendingErrorCode(
        'Your email domain is not authorized for this company. An administrator has been notified.',
      ),
    ).toBe('access_denied');
    expect(inferAccessPendingErrorCode('Invalid code')).toBe(null);
  });
});
