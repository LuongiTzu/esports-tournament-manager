import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { BracketOperationsService } from './bracket-operations.service';
import { BracketsController } from './brackets.controller';

describe('BracketsController', () => {
  const operations = {
    generate: jest.fn().mockResolvedValue({ matchCount: 1 }),
  } as unknown as BracketOperationsService;
  const controller = new BracketsController(operations);

  it('delegates successful generation', async () => {
    await expect(controller.generate('round-1', true)).resolves.toEqual({
      matchCount: 1,
    });
    expect(operations.generate).toHaveBeenCalledWith('round-1', true);
  });

  it('protects mutation routes with existing auth and ownership guards', () => {
    const method = BracketsController.prototype.generate;
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      JwtAuthGuard,
      OwnershipGuard,
    ]);
  });

  it('registers POST /rounds/:id/generate', () => {
    expect(Reflect.getMetadata(PATH_METADATA, BracketsController)).toBe(
      'rounds',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, BracketsController.prototype.generate),
    ).toBe(':id/generate');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        BracketsController.prototype.generate,
      ),
    ).toBe(RequestMethod.POST);
  });
});
