/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { ActivityEmailPublisher } from '../common/ports/activity-email-publisher';
import { PrismaService } from '../prisma/prisma.service';
import { UserAdministrationService } from './user-administration.service';

describe('UserAdministrationService account email notifications', () => {
  it.each([true, false])(
    'publishes the account lock state after persistence: %s',
    async (isLocked) => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            isLocked: !isLocked,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'user-1',
            isLocked,
          }),
        },
      } as unknown as PrismaService;
      const activityEmails = {
        publish: jest.fn().mockResolvedValue(undefined),
      } as unknown as ActivityEmailPublisher;
      const service = new UserAdministrationService(prisma, activityEmails);

      await service.setUserLockStatus('admin-1', 'user-1', isLocked);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ isLocked }),
        }),
      );
      expect(activityEmails.publish).toHaveBeenCalledWith({
        kind: 'ACCOUNT_LOCK_CHANGED',
        userId: 'user-1',
        isLocked,
      });
    },
  );

  it('does not email when the requested account lock state is unchanged', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          isLocked: true,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'user-1',
          isLocked: true,
        }),
      },
    } as unknown as PrismaService;
    const activityEmails = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as ActivityEmailPublisher;
    const service = new UserAdministrationService(prisma, activityEmails);

    await service.setUserLockStatus('admin-1', 'user-1', true);

    expect(activityEmails.publish).not.toHaveBeenCalled();
  });
});
