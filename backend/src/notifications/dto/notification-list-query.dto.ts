import {
  BooleanQueryField,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';

export class NotificationListQueryDto extends PaginationQueryDto {
  @BooleanQueryField()
  isRead?: boolean;
}
