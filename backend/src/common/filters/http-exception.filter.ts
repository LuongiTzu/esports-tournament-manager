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
    const structuredBody = isRecord(body) ? body : undefined;
    const rawMessage = structuredBody?.message ?? body;
    const errors = Array.isArray(structuredBody?.errors)
      ? structuredBody.errors
      : Array.isArray(rawMessage)
        ? rawMessage
        : [];
    const message = Array.isArray(rawMessage)
      ? 'Validation failed'
      : typeof rawMessage === 'string'
        ? rawMessage
        : status === 500
          ? 'Internal server error'
          : exception instanceof Error
            ? exception.message
            : 'Request failed';

    const publicBody: Record<string, unknown> = {
      statusCode: status,
      message,
      errors,
    };

    if (typeof structuredBody?.code === 'string') {
      publicBody.code = structuredBody.code;
    }
    if (Array.isArray(structuredBody?.matches)) {
      publicBody.matches = structuredBody.matches;
    }

    response.status(status).json(publicBody);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
