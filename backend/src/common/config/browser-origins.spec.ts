import {
  configuredBrowserOrigins,
  isConfiguredBrowserOrigin,
  parseBrowserOrigins,
} from './browser-origins';

describe('browser origin configuration', () => {
  it('parses, normalizes and deduplicates configured origins', () => {
    expect(
      parseBrowserOrigins(
        'https://arena.example/, https://admin.arena.example, https://arena.example',
      ),
    ).toEqual(['https://arena.example', 'https://admin.arena.example']);
  });

  it('prefers ALLOWED_ORIGINS and falls back to FRONTEND_URL', () => {
    expect(
      configuredBrowserOrigins({
        ALLOWED_ORIGINS: 'https://admin.arena.example',
        FRONTEND_URL: 'https://arena.example',
      }),
    ).toEqual(['https://admin.arena.example']);
    expect(
      configuredBrowserOrigins({ FRONTEND_URL: 'https://arena.example' }),
    ).toEqual(['https://arena.example']);
  });

  it('allows configured browser origins and requests without an Origin header', () => {
    const configured = parseBrowserOrigins(
      'https://arena.example,https://admin.arena.example',
    );

    expect(isConfiguredBrowserOrigin(undefined, configured)).toBe(true);
    expect(
      isConfiguredBrowserOrigin('https://admin.arena.example', configured),
    ).toBe(true);
    expect(
      isConfiguredBrowserOrigin('https://attacker.example', configured),
    ).toBe(false);
  });

  it.each([
    'not-a-url',
    'ftp://arena.example',
    'https://arena.example/path',
    'https://user:password@arena.example',
  ])('rejects invalid browser origin %s', (origin) => {
    expect(() => parseBrowserOrigins(origin)).toThrow(
      `Invalid browser origin: ${origin}`,
    );
  });
});
