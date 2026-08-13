import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    return next.handle().pipe(
      map((data: unknown) => ({
        statusCode: response.statusCode,
        message: 'Success',
        data,
      })),
    );
  }
}
