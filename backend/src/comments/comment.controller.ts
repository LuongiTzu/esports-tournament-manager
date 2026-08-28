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
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { VisibilityResource } from '../common/decorators/visibility.decorator';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/comment.dto';
import { CommentListQueryDto } from './dto/comment-list-query.dto';

@ApiTags('comments')
@Controller()
export class CommentController {
  constructor(private readonly comments: CommentService) {}

  @UseGuards(JwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('tournaments/:slug/comments')
  create(
    @Param('slug') slug: string,
    @CurrentUser('id') authorId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(
      slug,
      authorId,
      dto.content,
      dto.replyToCommentId,
    );
  }

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @Get('tournaments/:slug/comments')
  findByTournament(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: CommentListQueryDto,
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
