import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TournamentsService } from '../tournaments/tournaments.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private tournamentsService: TournamentsService,
  ) {}

  /**
   * GET /api/users/me
   * Lấy thông tin hồ sơ người dùng hiện tại (UC-U03)
   */
  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  /**
   * PATCH /api/users/me
   * Cập nhật hồ sơ cá nhân (UC-U03)
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  /**
   * GET /api/users/me/tournaments?tab=organized|joined
   * Danh sách giải đã tổ chức / đã tham gia (UC-U18)
   */
  @Get('me/tournaments')
  getMyTournaments(
    @CurrentUser('id') userId: string,
    @Query('tab') tab: 'organized' | 'joined' = 'organized',
  ) {
    return this.tournamentsService.findMyTournaments(userId, tab);
  }
}
