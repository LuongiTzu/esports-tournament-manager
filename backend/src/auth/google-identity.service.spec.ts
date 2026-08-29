import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleIdentityService } from './google-identity.service';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

describe('GoogleIdentityService', () => {
  const config = {
    get: jest.fn().mockReturnValue('configured-client-id'),
  } as unknown as ConfigService;
  const service = new GoogleIdentityService(config);

  beforeEach(() => mockVerifyIdToken.mockReset());

  it('verifies audience and maps a verified Google identity', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'Player@Gmail.com',
        email_verified: true,
        name: 'Google Player',
        picture: 'https://example.com/avatar.png',
      }),
    });

    await expect(service.verifyCredential('google-jwt')).resolves.toEqual({
      subject: 'google-subject',
      email: 'player@gmail.com',
      displayName: 'Google Player',
      avatarUrl: 'https://example.com/avatar.png',
      canSafelyLinkByEmail: true,
    });
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'google-jwt',
      audience: 'configured-client-id',
    });
  });

  it('rejects an unverified email payload', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'player@example.com',
        email_verified: false,
      }),
    });

    await expect(service.verifyCredential('google-jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('normalizes verification failures to UnauthorizedException', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid signature'));

    await expect(service.verifyCredential('google-jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
