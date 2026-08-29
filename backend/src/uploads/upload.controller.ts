import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { TeamAccess, TeamAccessGuard } from '../teams/guards/team-access.guard';
import { imageUploadOptions } from './upload.config';
import { UploadService } from './upload.service';

const imageBody = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

@ApiTags('uploads')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  private requireFile(file?: Express.Multer.File): Express.Multer.File {
    if (!file) throw new BadRequestException('Image file is required');
    return file;
  }

  @Post('users/me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody(imageBody)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  avatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploads.userAvatar(userId, this.requireFile(file));
  }

  @Post('teams/:id/logo')
  @UseGuards(EmailVerifiedGuard, TeamAccessGuard)
  @TeamAccess('CAPTAIN_OR_ORGANIZER')
  @ApiConsumes('multipart/form-data')
  @ApiBody(imageBody)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  teamLogo(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploads.teamLogo(id, this.requireFile(file));
  }

  @Post('teams/:id/members/:memberId/avatar')
  @UseGuards(EmailVerifiedGuard, TeamAccessGuard)
  @TeamAccess('CAPTAIN_OR_ORGANIZER')
  @ApiConsumes('multipart/form-data')
  @ApiBody(imageBody)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  memberAvatar(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploads.memberAvatar(id, memberId, this.requireFile(file));
  }

  @Post('tournaments/:tournamentId/banner')
  @UseGuards(EmailVerifiedGuard, OwnershipGuard)
  @Ownership('tournamentId')
  @ApiConsumes('multipart/form-data')
  @ApiBody(imageBody)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  banner(
    @Param('tournamentId') tournamentId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploads.tournamentBanner(tournamentId, this.requireFile(file));
  }
}
