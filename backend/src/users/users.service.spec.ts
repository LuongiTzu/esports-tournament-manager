/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

function harness() {
  const profile = {
    id: 'user-1',
    email: 'player@example.test',
    displayName: 'Player',
    avatarUrl: 'https://example.test/avatar.png',
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(profile),
      update: jest.fn().mockResolvedValue(profile),
    },
  } as unknown as PrismaService;
  return { service: new UsersService(prisma), prisma, profile };
}

describe('UsersService', () => {
  it('returns a safe profile without requesting credentials or reset tokens', async () => {
    const { service, prisma, profile } = harness();

    await expect(service.getProfile(profile.id)).resolves.toEqual(profile);
    const select = jest.mocked(prisma.user.findUnique).mock.calls[0][0].select;
    expect(select).toMatchObject({ id: true, email: true, displayName: true });
    expect(select).not.toHaveProperty('passwordHash');
    expect(select).not.toHaveProperty('refreshToken');
    expect(select).not.toHaveProperty('resetPasswordToken');
  });

  it('rejects profile updates when the account no longer exists', async () => {
    const { service, prisma } = harness();
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(
      service.updateProfile('missing', { displayName: 'New name' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('preserves omitted fields and clears only explicitly emptied optional values', async () => {
    const { service, prisma } = harness();

    await service.updateProfile('user-1', {
      displayName: 'Updated Player',
      avatarUrl: '',
      birthDate: '2000-01-02',
      bio: '',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: {
          displayName: 'Updated Player',
          avatarUrl: null,
          birthDate: new Date('2000-01-02'),
          bio: null,
        },
      }),
    );
    const data = jest.mocked(prisma.user.update).mock.calls[0][0].data;
    expect(data).not.toHaveProperty('currentAddress');
    expect(data).not.toHaveProperty('phoneNumber');
  });
});
