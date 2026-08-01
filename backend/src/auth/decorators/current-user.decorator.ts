import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

/**
 * Decorator để lấy user hiện tại từ request.
 *
 * @example
 * async getMe(@CurrentUser() user: AuthenticatedUser) {}
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
