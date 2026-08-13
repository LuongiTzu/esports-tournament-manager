import { SetMetadata } from '@nestjs/common';

export const VISIBILITY_RESOURCE_KEY = 'visibility_resource';

/** Identifies how VisibilityGuard resolves the resource's tournament. */
export const VisibilityResource = (resource: string) =>
  SetMetadata(VISIBILITY_RESOURCE_KEY, resource);
