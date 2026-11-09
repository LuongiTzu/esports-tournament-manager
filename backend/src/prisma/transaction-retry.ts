import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const MAX_ATTEMPTS = 3;

/** Retry only transactions PostgreSQL aborted because of a write conflict/deadlock. */
export async function retrySerializableTransaction<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034' ||
        attempt >= MAX_ATTEMPTS
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 20 * attempt));
    }
  }
}
