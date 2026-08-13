import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { VisibilityResource } from '../common/decorators/visibility.decorator';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/comment.dto';

@Controller()
export class CommentController {
  constructor(private readonly comments: CommentService) {}

  @UseGuards(JwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @Post('tournaments/:slug/comments')
  create(
    @Param('slug') slug: string,
    @CurrentUser('id') authorId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(slug, authorId, dto.content);
  }

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @Get('tournaments/:slug/comments')
  findByTournament(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: { page?: number; limit?: number },
  ) {
    return this.comments.findByTournament(slug, user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('comments/:id/hide')
  hide(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comments.hide(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comments.remove(id, user);
  }
}
