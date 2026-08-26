import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTournamentDto } from './create-tournament.dto';

/**
 * DTO cập nhật giải đấu (UC-U09) — kế thừa toàn bộ validate của CreateTournamentDto,
 * mọi field thành optional.
 *
 * `rounds` bị loại: thêm/sửa vòng đấu đi qua endpoint riêng `/rounds`.
 */
export class UpdateTournamentDto extends PartialType(
  OmitType(CreateTournamentDto, ['rounds'] as const),
) {}
