import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_PARAM_KEY = 'ownership_param';

/**
 * Đánh dấu param chứa tournamentId để OwnershipGuard kiểm tra quyền sở hữu.
 *
 * @example
 * @Ownership('tournamentId')
 * @UseGuards(JwtAuthGuard, OwnershipGuard)
 * async updateTournament(@Param('tournamentId') tournamentId: string) {}
 */
export const Ownership = (param: string = 'id') =>
  SetMetadata(OWNERSHIP_PARAM_KEY, param);
