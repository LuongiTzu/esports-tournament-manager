import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationErrorCode } from '../errors/application-error-code';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Bạn chưa đăng nhập');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: ApplicationErrorCode.EMAIL_NOT_VERIFIED,
        message: 'Vui lòng xác minh email trước khi thực hiện thao tác này',
      });
    }

    return true;
  }
}
