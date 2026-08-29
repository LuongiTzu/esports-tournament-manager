/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OWNERSHIP_PARAM_KEY } from '../common/decorators/ownership.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import {
  TEAM_ACCESS_KEY,
  TeamAccessGuard,
} from '../teams/guards/team-access.guard';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

describe('UploadController authorization contract', () => {
  const uploads = {
    userAvatar: jest.fn().mockResolvedValue({ url: '/uploads/avatar.png' }),
  } as unknown as UploadService;
  const controller = new UploadController(uploads);

  it('requires authentication for every upload endpoint', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UploadController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('restricts team and member images to captain or organizer', () => {
    for (const method of [
      UploadController.prototype.teamLogo,
      UploadController.prototype.memberAvatar,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
        EmailVerifiedGuard,
        TeamAccessGuard,
      ]);
      expect(Reflect.getMetadata(TEAM_ACCESS_KEY, method)).toBe(
        'CAPTAIN_OR_ORGANIZER',
      );
    }
  });

  it('restricts tournament banners to the tournament owner', () => {
    const method = UploadController.prototype.banner;
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      EmailVerifiedGuard,
      OwnershipGuard,
    ]);
    expect(Reflect.getMetadata(OWNERSHIP_PARAM_KEY, method)).toBe(
      'tournamentId',
    );
  });

  it('uses the authenticated user ID for avatar persistence', async () => {
    const uploaded = {} as Express.Multer.File;
    await controller.avatar('user-1', uploaded);
    expect(uploads.userAvatar).toHaveBeenCalledWith('user-1', uploaded);
  });

  it('rejects a request without a multipart image', () => {
    expect(() => controller.avatar('user-1')).toThrow(BadRequestException);
  });
});
