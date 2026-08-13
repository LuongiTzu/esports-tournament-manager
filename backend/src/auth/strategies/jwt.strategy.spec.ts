import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy account lock', () => {
  it('rejects an otherwise valid token after the user is locked', async () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          displayName: 'User',
          avatarUrl: null,
          birthDate: null,
          currentAddress: null,
          phoneNumber: null,
          gender: null,
          bio: null,
          role: 'SIGNED_UP_USER',
          isLocked: true,
          tokenVersion: 0,
        }),
      },
    } as unknown as PrismaService;
    const strategy = new JwtStrategy(config, prisma);
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: 'SIGNED_UP_USER',
      tokenVersion: 0,
    };

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
