/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

describe('CommentController', () => {
  const comments = { create: jest.fn() } as unknown as CommentService;
  const controller = new CommentController(comments);

  it('takes the author identity separately from the request DTO', async () => {
    jest.mocked(comments.create).mockResolvedValue({ id: 'c-1' } as never);
    await controller.create('cup', 'authenticated-user', { content: 'Hello' });
    expect(comments.create).toHaveBeenCalledWith(
      'cup',
      'authenticated-user',
      'Hello',
      undefined,
    );
  });

  it('requires authentication to create comments', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      CommentController.prototype.create,
    ) as unknown[];
    expect(guards[0]).toBe(JwtAuthGuard);
  });

  it('forwards only the clicked reply target identifier', async () => {
    jest.mocked(comments.create).mockResolvedValue({ id: 'reply-1' } as never);
    await controller.create('cup', 'authenticated-user', {
      content: 'Reply',
      replyToCommentId: 'clicked-comment',
    });
    expect(comments.create).toHaveBeenCalledWith(
      'cup',
      'authenticated-user',
      'Reply',
      'clicked-comment',
    );
  });
});
