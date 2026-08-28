import { ApiProperty } from '@nestjs/swagger';

export class TournamentFavoriteMutationResultDto {
  @ApiProperty({ example: true })
  isFavorited!: boolean;

  @ApiProperty({ example: 42, minimum: 0 })
  favoriteCount!: number;
}

export class TournamentFavoriteViewFieldsDto {
  @ApiProperty({ example: 42, minimum: 0 })
  favoriteCount!: number;

  @ApiProperty({ example: false })
  isFavorited!: boolean;
}
