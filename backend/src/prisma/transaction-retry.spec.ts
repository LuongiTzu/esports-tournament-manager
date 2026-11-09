import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { retrySerializableTransaction } from './transaction-retry';

function writeConflict() {
  return new Prisma.PrismaClientKnownRequestError('Write conflict', {
    code: 'P2034',
    clientVersion: '6.19.3',
  });
}

describe('retrySerializableTransaction', () => {
  it('retries an aborted transaction and returns the committed result', async () => {
    const transaction = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(writeConflict())
      .mockResolvedValue('committed');
    const prisma = { $transaction: transaction } as unknown as PrismaService;

    await expect(
      retrySerializableTransaction(prisma, () => Promise.resolve('unused')),
    ).resolves.toBe('committed');
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('stops after three conflicts', async () => {
    const transaction = jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(writeConflict());
    const prisma = { $transaction: transaction } as unknown as PrismaService;

    await expect(
      retrySerializableTransaction(prisma, () => Promise.resolve()),
    ).rejects.toMatchObject({ code: 'P2034' });
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry unrelated failures', async () => {
    const failure = new Error('Database unavailable');
    const transaction = jest.fn<Promise<void>, []>().mockRejectedValue(failure);
    const prisma = { $transaction: transaction } as unknown as PrismaService;

    await expect(
      retrySerializableTransaction(prisma, () => Promise.resolve()),
    ).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
