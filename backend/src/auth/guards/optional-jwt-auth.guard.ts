import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Xác thực JWT nhưng KHÔNG bắt buộc — request không có token vẫn đi tiếp,
 * `req.user` khi đó là undefined. Dùng cho route công khai nhưng trả thêm
 * dữ liệu riêng nếu người xem là BTC/đội trưởng.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<T>(err: unknown, user: T): T | undefined {
    return user || undefined;
  }
}
