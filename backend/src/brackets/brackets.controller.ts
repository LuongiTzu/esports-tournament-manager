import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { BracketOperationsService } from './bracket-operations.service';
import { UpdateSeedsDto } from './dto/bracket-operations.dto';

@Controller('rounds')
export class BracketsController {
  constructor(private readonly operations: BracketOperationsService) {}

  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('round:id')
  @Post(':id/generate')
  generate(
    @Param('id') id: string,
    @Query('force', new ParseBoolPipe({ optional: true })) force = false,
  ) {
    return this.operations.generate(id, force);
  }

  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('round:id')
  @Patch(':id/seeds')
  updateSeeds(@Param('id') id: string, @Body() dto: UpdateSeedsDto) {
    return this.operations.updateSeeds(id, dto);
  }

  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('round:id')
  @Post(':id/advance')
  advance(@Param('id') id: string) {
    return this.operations.advance(id);
  }

  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('round:id')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.operations.remove(id);
  }

  @Get(':id/bracket')
  getBracket(@Param('id') id: string) {
    return this.operations.getBracket(id);
  }
}
