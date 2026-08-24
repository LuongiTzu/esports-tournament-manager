export const ApplicationErrorCode = {
  REGISTRATION_INVALID: 'REGISTRATION_INVALID',
  BANNED_CONTENT: 'BANNED_CONTENT',
} as const;

export type ApplicationErrorCode =
  (typeof ApplicationErrorCode)[keyof typeof ApplicationErrorCode];
