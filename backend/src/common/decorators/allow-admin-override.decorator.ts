import { SetMetadata } from '@nestjs/common';

export const ALLOW_ADMIN_OVERRIDE_KEY = 'allow_admin_override';

/** Allows an Admin with an active, explicit override session to act as Organizer. */
export const AllowAdminOverride = () =>
  SetMetadata(ALLOW_ADMIN_OVERRIDE_KEY, true);
