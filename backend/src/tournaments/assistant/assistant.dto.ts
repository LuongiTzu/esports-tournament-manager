import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';
  @IsString()
  @Length(1, 8000)
  content!: string;
}

export class AssistantChatDto {
  @IsString()
  @Length(1, 1500)
  message!: string;
  @IsIn(['vi', 'en'])
  locale: 'vi' | 'en' = 'vi';
  @IsIn(['discover', 'tournament', 'create', 'manage', 'general'])
  page!: 'discover' | 'tournament' | 'create' | 'manage' | 'general';
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  slug?: string;
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history: ChatMessageDto[] = [];
}
