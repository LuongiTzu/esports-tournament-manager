/* eslint-disable @typescript-eslint/unbound-method */
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { VISIBILITY_RESOURCE_KEY } from '../common/decorators/visibility.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { BracketOperationsService } from './bracket-operations.service';
import { BracketsController } from './brackets.controller';
import { SwissService } from './swiss.service';

describe('BracketsController', () => {
  const operations = {
    generate: jest.fn().mockResolvedValue({ matchCount: 1 }),
  } as unknown as BracketOperationsService;
  const swiss = {
    generateNextSwissRound: jest.fn().mockResolvedValue({
      roundId: 'round-1',
      bracketRound: 2,
      matchCount: 2,
    }),
  } as unknown as SwissService;
  const controller = new BracketsController(operations, swiss);

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

  it('delegates Swiss next-round generation to SwissService', async () => {
    await expect(controller.generateNextSwissRound('round-1')).resolves.toEqual(
      expect.objectContaining({ bracketRound: 2, matchCount: 2 }),
    );
    expect(swiss.generateNextSwissRound).toHaveBeenCalledWith('round-1');
  });

  it('registers and protects POST /rounds/:id/swiss/generate-next', () => {
    const method = BracketsController.prototype.generateNextSwissRound;
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(
      ':id/swiss/generate-next',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      JwtAuthGuard,
      OwnershipGuard,
    ]);
  });

  it('uses optional authentication and tournament visibility resolution', () => {
    const method = BracketsController.prototype.getBracket;

    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      OptionalJwtAuthGuard,
      VisibilityGuard,
    ]);
    expect(Reflect.getMetadata(VISIBILITY_RESOURCE_KEY, method)).toBe(
      'round:id',
    );
  });
});
