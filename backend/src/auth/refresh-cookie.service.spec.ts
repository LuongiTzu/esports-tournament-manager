import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { RefreshCookieService } from './refresh-cookie.service';

function service(env: Record<string, string> = {}) {
  const config = {
    get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
  } as unknown as ConfigService;
  return new RefreshCookieService(config);
}

describe('RefreshCookieService', () => {
  it('sets an HttpOnly host cookie scoped to auth endpoints', () => {
    const cookies = service();
    const response = { cookie: jest.fn() } as unknown as Response;

    cookies.set(response, 'raw-refresh');

    expect(response.cookie).toHaveBeenCalledWith(
      'etm_refresh',
      'raw-refresh',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 604800000,
      }),
    );
  });

  it('requires a trusted browser origin for cookie-authenticated requests', () => {
    const cookies = service({ FRONTEND_URL: 'https://arena.example' });
    const request = {
      headers: { origin: 'https://attacker.example' },
    } as Request;

    expect(() => cookies.assertTrustedOrigin(request)).toThrow(
      ForbiddenException,
    );
  });

  it('accepts every configured browser origin', () => {
    const cookies = service({
      FRONTEND_URL: 'https://arena.example',
      ALLOWED_ORIGINS: 'https://arena.example, https://admin.arena.example/',
    });

    expect(() =>
      cookies.assertTrustedOrigin({
        headers: { origin: 'https://admin.arena.example' },
      } as Request),
    ).not.toThrow();
  });

  it('reads a URL-encoded refresh cookie', () => {
    const cookies = service();
    const request = {
      headers: { cookie: 'theme=dark; etm_refresh=a%2Eb%2Ec' },
    } as Request;

    expect(cookies.read(request)).toBe('a.b.c');
  });

  it('clears the cookie without retaining its positive max age', () => {
    const cookies = service();
    const response = { clearCookie: jest.fn() } as unknown as Response;

    cookies.clear(response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'etm_refresh',
      expect.not.objectContaining({ maxAge: expect.anything() }),
    );
  });
});
