import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshCookieService } from './refresh-cookie.service';

describe('AuthController refresh boundary', () => {
  const auth = {
    refreshTokens: jest.fn(),
    googleLogin: jest.fn(),
    logout: jest.fn(),
  } as unknown as AuthService;
  const refreshCookie = {
    read: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    assertTrustedOrigin: jest.fn(),
  } as unknown as RefreshCookieService;
  const controller = new AuthController(auth, refreshCookie);
  const request = { headers: {} } as Request;
  const response = {} as Response;

  beforeEach(() => jest.clearAllMocks());

  it('passes the Google credential DTO to AuthService', async () => {
    jest.mocked(auth.googleLogin).mockResolvedValue({
      message: 'Đăng nhập Google thành công',
      user: {} as never,
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    await expect(
      controller.googleLogin({ credential: 'google-jwt' }, request, response),
    ).resolves.toEqual({
      message: 'Đăng nhập Google thành công',
      user: {},
      accessToken: 'access',
    });

    expect(auth.googleLogin).toHaveBeenCalledWith({
      credential: 'google-jwt',
    });
    expect(refreshCookie.set).toHaveBeenCalledWith(response, 'refresh');
  });

  it('rotates the refresh cookie without exposing it in the response', async () => {
    jest.mocked(refreshCookie.read).mockReturnValue('raw-refresh');
    jest.mocked(auth.refreshTokens).mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    await expect(controller.refresh(request, response)).resolves.toEqual({
      accessToken: 'access',
    });
    expect(auth.refreshTokens).toHaveBeenCalledWith('raw-refresh');
    expect(refreshCookie.set).toHaveBeenCalledWith(response, 'refresh');
  });

  it('clears an invalid refresh cookie', async () => {
    jest.mocked(refreshCookie.read).mockImplementation(() => {
      throw new UnauthorizedException();
    });

    await expect(controller.refresh(request, response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshCookie.clear).toHaveBeenCalledWith(response);
    expect(auth.refreshTokens).not.toHaveBeenCalled();
  });
});
