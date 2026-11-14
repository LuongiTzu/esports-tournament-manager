import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApplicationErrorCode } from '../errors/application-error-code';

const RATE_LIMIT_MESSAGE =
  'Bạn thao tác quá nhiều lần. Vui lòng chờ rồi thử lại sau.';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isPayloadTooLarge(exception)
          ? HttpStatus.PAYLOAD_TOO_LARGE
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
    const message =
      status === 429
        ? RATE_LIMIT_MESSAGE
        : status === HttpStatus.PAYLOAD_TOO_LARGE
          ? 'Request body is too large'
          : Array.isArray(rawMessage)
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
    } else if (status === 429) {
      publicBody.code = ApplicationErrorCode.RATE_LIMITED;
    }
    if (Array.isArray(structuredBody?.matches)) {
      publicBody.matches = structuredBody.matches;
    }
    if (isRecord(structuredBody?.details)) {
      publicBody.details = structuredBody.details;
    }

    response.status(status).json(publicBody);
  }
}

function isPayloadTooLarge(exception: unknown): boolean {
  return (
    isRecord(exception) &&
    exception.type === 'entity.too.large' &&
    exception.status === HttpStatus.PAYLOAD_TOO_LARGE
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
