import { PrismaService } from '../prisma/prisma.service';
import { ImageStorageService } from './image-storage.service';
import { UploadService } from './upload.service';

const file = {} as Express.Multer.File;

function harness() {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        avatarUrl: 'https://cdn.example.com/old-avatar.jpg',
      }),
      update: jest.fn().mockResolvedValue({ id: 'user-1' }),
    },
    team: {
      findUnique: jest.fn().mockResolvedValue({
        logoUrl: '/uploads/team-logos/11111111-1111-4111-8111-111111111111.png',
      }),
      update: jest.fn().mockResolvedValue({ id: 'team-1' }),
    },
    teamMember: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'member-1', avatarUrl: null }),
      update: jest.fn().mockResolvedValue({ id: 'member-1' }),
    },
    tournament: {
      findUnique: jest.fn().mockResolvedValue({ bannerUrl: null }),
      update: jest.fn().mockResolvedValue({ id: 'tournament-1' }),
    },
  };
  const storage = {
    store: jest.fn((category: string) =>
      Promise.resolve({ url: `/uploads/${category}/new-image.png` }),
    ),
    deleteOwned: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new UploadService(
      prisma as unknown as PrismaService,
      storage as unknown as ImageStorageService,
    ),
    prisma,
    storage,
  };
}

describe('UploadService', () => {
  it('stores the current user avatar and preserves external URL compatibility', async () => {
    const { service, prisma, storage } = harness();

    await expect(service.userAvatar('user-1', file)).resolves.toEqual({
      url: '/uploads/user-avatars/new-image.png',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: '/uploads/user-avatars/new-image.png' },
    });
    expect(storage.deleteOwned).toHaveBeenCalledWith(
      'https://cdn.example.com/old-avatar.jpg',
      'user-avatars',
    );
  });

  it('stores team logos and cleans up a previous locally owned image', async () => {
    const { service, prisma, storage } = harness();

    await service.teamLogo('team-1', file);

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { logoUrl: '/uploads/team-logos/new-image.png' },
    });
    expect(storage.deleteOwned).toHaveBeenLastCalledWith(
      '/uploads/team-logos/11111111-1111-4111-8111-111111111111.png',
      'team-logos',
    );
  });

  it('scopes member avatar updates to the requested team', async () => {
    const { service, prisma } = harness();

    await service.memberAvatar('team-1', 'member-1', file);

    expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({
      where: { id: 'member-1', teamId: 'team-1' },
      select: { id: true, avatarUrl: true },
    });
    expect(prisma.teamMember.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { avatarUrl: '/uploads/member-avatars/new-image.png' },
    });
  });

  it('stores tournament banners in their own category', async () => {
    const { service, prisma } = harness();

    await service.tournamentBanner('tournament-1', file);

    expect(prisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tournament-1' },
      data: { bannerUrl: '/uploads/tournament-banners/new-image.png' },
    });
  });

  it('removes the newly stored file if database persistence fails', async () => {
    const { service, prisma, storage } = harness();
    prisma.team.update.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.teamLogo('team-1', file)).rejects.toThrow(
      'database unavailable',
    );
    expect(storage.deleteOwned).toHaveBeenCalledWith(
      '/uploads/team-logos/new-image.png',
      'team-logos',
    );
  });
});
