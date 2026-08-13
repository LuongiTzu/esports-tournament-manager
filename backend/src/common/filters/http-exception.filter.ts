import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const rawMessage =
      typeof body === 'object' && body !== null && 'message' in body
        ? (body as { message?: unknown }).message
        : body;
    const errors = Array.isArray(rawMessage) ? rawMessage : [];
    const message = Array.isArray(rawMessage)
      ? 'Validation failed'
      : typeof rawMessage === 'string'
        ? rawMessage
        : status === 500
          ? 'Internal server error'
          : exception instanceof Error
            ? exception.message
            : 'Request failed';

    response.status(status).json({
      statusCode: status,
      message,
      errors,
    });
  }
}
