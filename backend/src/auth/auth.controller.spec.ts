import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController refresh boundary', () => {
  const auth = {
    refreshTokens: jest.fn(),
    googleLogin: jest.fn(),
  } as unknown as AuthService;
  const controller = new AuthController(auth);

  beforeEach(() => jest.clearAllMocks());

  it('passes the Google credential DTO to AuthService', async () => {
    jest.mocked(auth.googleLogin).mockResolvedValue({
      message: 'Đăng nhập Google thành công',
      user: {} as never,
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    await controller.googleLogin({ credential: 'google-jwt' });

    expect(auth.googleLogin).toHaveBeenCalledWith({
      credential: 'google-jwt',
    });
  });

  it('passes only the extracted bearer token to AuthService', async () => {
    jest.mocked(auth.refreshTokens).mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    await expect(controller.refresh('Bearer raw-refresh')).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(auth.refreshTokens).toHaveBeenCalledWith('raw-refresh');
  });

  it.each([undefined, '', 'Basic token', 'Bearer   '])(
    'rejects a missing bearer refresh token',
    async (header) => {
      await expect(controller.refresh(header as string)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(auth.refreshTokens).not.toHaveBeenCalled();
    },
  );
});
