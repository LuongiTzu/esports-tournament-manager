import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApplicationErrorCode } from '../errors/application-error-code';
import { HttpExceptionFilter } from './http-exception.filter';

function catchException(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  new HttpExceptionFilter().catch(exception, host);

  return { status, json };
}

describe('HttpExceptionFilter', () => {
  it('keeps the established envelope for a string message', () => {
    const { status, json } = catchException(
      new BadRequestException('Invalid request'),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid request',
      errors: [],
    });
  });

  it('maps ValidationPipe message arrays to validation errors', () => {
    const { json } = catchException(
      new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: [
          'page must be an integer number',
          'page must not be less than 1',
        ],
      }),
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Validation failed',
      errors: [
        'page must be an integer number',
        'page must not be less than 1',
      ],
    });
  });

  it('preserves structured errors and a stable application code', () => {
    const errors = [
      { field: 'members', memberIndex: null, message: 'Roster is too small' },
    ];
    const { json } = catchException(
      new UnprocessableEntityException({
        code: ApplicationErrorCode.REGISTRATION_INVALID,
        message: 'Invalid registration',
        errors,
      }),
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 422,
      code: ApplicationErrorCode.REGISTRATION_INVALID,
      message: 'Invalid registration',
      errors,
    });
  });

  it('preserves approved content-filter match metadata', () => {
    const matches = [{ keyword: 'spam', category: 'PROFANITY' }];
    const { json } = catchException(
      new BadRequestException({
        code: ApplicationErrorCode.BANNED_CONTENT,
        message: 'Content contains prohibited keywords',
        matches,
        internalReason: 'must not be public',
      }),
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: ApplicationErrorCode.BANNED_CONTENT,
      message: 'Content contains prohibited keywords',
      errors: [],
      matches,
    });
  });

  it('returns a friendly Vietnamese message for rate limiting', () => {
    const { status, json } = catchException(
      new HttpException('ThrottlerException: Too Many Requests', 429),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      code: ApplicationErrorCode.RATE_LIMITED,
      message: 'Bạn thao tác quá nhiều lần. Vui lòng chờ rồi thử lại sau.',
      errors: [],
    });
  });

  it('does not expose internal errors', () => {
    const { json } = catchException(
      new Error('database connection includes sensitive details'),
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      errors: [],
    });
  });
});
