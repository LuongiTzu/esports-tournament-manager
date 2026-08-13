import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadService {
  constructor(private readonly prisma: PrismaService) {}

  private url(file: Express.Multer.File): string {
    return `/uploads/${file.filename}`;
  }

  async userAvatar(userId: string, file: Express.Multer.File) {
    const avatarUrl = this.url(file);
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return { url: avatarUrl };
  }

  async teamLogo(teamId: string, file: Express.Multer.File) {
    const logoUrl = this.url(file);
    await this.prisma.team.update({ where: { id: teamId }, data: { logoUrl } });
    return { url: logoUrl };
  }

  async memberAvatar(
    teamId: string,
    memberId: string,
    file: Express.Multer.File,
  ) {
    const member = await this.prisma.teamMember.findFirst({
      where: { id: memberId, teamId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Team member not found');
    const avatarUrl = this.url(file);
    await this.prisma.teamMember.update({
      where: { id: memberId },
      data: { avatarUrl },
    });
    return { url: avatarUrl };
  }

  async tournamentBanner(tournamentId: string, file: Express.Multer.File) {
    const bannerUrl = this.url(file);
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { bannerUrl },
    });
    return { url: bannerUrl };
  }
}
