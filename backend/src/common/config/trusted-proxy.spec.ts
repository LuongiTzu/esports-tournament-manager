import { trustedProxyHops } from './trusted-proxy';

describe('trusted proxy configuration', () => {
  it('trusts no forwarded headers unless explicitly enabled', () => {
    expect(trustedProxyHops({})).toBe(0);
    expect(trustedProxyHops({ TRUST_PROXY_HOPS: '' })).toBe(0);
    expect(trustedProxyHops({ TRUST_PROXY_HOPS: '0' })).toBe(0);
  });

  it('supports the single production gateway', () => {
    expect(trustedProxyHops({ TRUST_PROXY_HOPS: '1' })).toBe(1);
  });

  it.each(['true', '*', '-1', '2', '0.5', 'unknown'])(
    'rejects unsupported trust configuration %s',
    (value) => {
      expect(() => trustedProxyHops({ TRUST_PROXY_HOPS: value })).toThrow(
        'TRUST_PROXY_HOPS must be 0',
      );
    },
  );
});
