import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AiSearchDto } from './dto/ai-search.dto';
import { TournamentAiSearchService } from './tournament-ai-search.service';

@Controller('tournaments')
export class TournamentAiSearchController {
  constructor(private readonly searchService: TournamentAiSearchService) {}

  @Post('ai-search')
  @HttpCode(200)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  search(@Body() dto: AiSearchDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.searchService.search(dto, user?.id);
  }
}
