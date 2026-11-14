import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { AssistantChatDto } from './assistant.dto';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}
  @Post('chat')
  @HttpCode(200)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  chat(@Body() dto: AssistantChatDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.assistant.chat(dto, user);
  }
}
