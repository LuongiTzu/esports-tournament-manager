import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImageCategory, ImageStorageService } from './image-storage.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorageService,
  ) {}

  async userAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.replace('user-avatars', user.avatarUrl, file, (url) =>
      this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: url },
      }),
    );
  }

  async teamLogo(teamId: string, file: Express.Multer.File) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { logoUrl: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    return this.replace('team-logos', team.logoUrl, file, (url) =>
      this.prisma.team.update({
        where: { id: teamId },
        data: { logoUrl: url },
      }),
    );
  }

  async memberAvatar(
    teamId: string,
    memberId: string,
    file: Express.Multer.File,
  ) {
    const member = await this.prisma.teamMember.findFirst({
      where: { id: memberId, teamId },
      select: { id: true, avatarUrl: true },
    });
    if (!member) throw new NotFoundException('Team member not found');
    return this.replace('member-avatars', member.avatarUrl, file, (url) =>
      this.prisma.teamMember.update({
        where: { id: memberId },
        data: { avatarUrl: url },
      }),
    );
  }

  async tournamentBanner(tournamentId: string, file: Express.Multer.File) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { bannerUrl: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return this.replace(
      'tournament-banners',
      tournament.bannerUrl,
      file,
      (url) =>
        this.prisma.tournament.update({
          where: { id: tournamentId },
          data: { bannerUrl: url },
        }),
    );
  }

  private async replace(
    category: ImageCategory,
    previousUrl: string | null,
    file: Express.Multer.File,
    persist: (url: string) => Promise<unknown>,
  ): Promise<{ url: string }> {
    const stored = await this.storage.store(category, file);
    try {
      await persist(stored.url);
    } catch (error) {
      await this.cleanup(stored.url, category);
      throw error;
    }
    await this.cleanup(previousUrl, category);
    return stored;
  }

  private async cleanup(
    url: string | null | undefined,
    category: ImageCategory,
  ): Promise<void> {
    try {
      await this.storage.deleteOwned(url, category);
    } catch (error) {
      this.logger.warn(
        `Could not remove replaced upload in ${category}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
