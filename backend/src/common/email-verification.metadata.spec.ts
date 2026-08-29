/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminController } from '../admin/admin.controller';
import { AuthController } from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BracketsController } from '../brackets/brackets.controller';
import { CommentController } from '../comments/comment.controller';
import { MatchesController } from '../matches/matches.controller';
import { NotificationController } from '../notifications/notification.controller';
import { ReportController } from '../reports/report.controller';
import { TeamsController } from '../teams/teams.controller';
import { TournamentsController } from '../tournaments/tournaments.controller';
import { UploadController } from '../uploads/upload.controller';
import { EmailVerifiedGuard } from './guards/email-verified.guard';

function guards(target: object) {
  return Reflect.getMetadata(GUARDS_METADATA, target) as
    Array<new (...args: never[]) => unknown> | undefined;
}

function expectVerifiedAfterJwt(target: object) {
  const applied = guards(target);
  expect(applied?.[0]).toBe(JwtAuthGuard);
  expect(applied?.[1]).toBe(EmailVerifiedGuard);
}

describe('verified-email endpoint policy', () => {
  it.each([
    ['create tournament', TournamentsController.prototype.create],
    ['update tournament', TournamentsController.prototype.update],
    ['delete tournament', TournamentsController.prototype.remove],
    ['create round', TournamentsController.prototype.addRound],
    ['register team', TeamsController.prototype.register],
    ['add a team as organizer', TeamsController.prototype.addManual],
    ['update team', TeamsController.prototype.update],
    ['add member', TeamsController.prototype.addMember],
    ['update member', TeamsController.prototype.updateMember],
    ['remove member', TeamsController.prototype.removeMember],
    ['review team registration', TeamsController.prototype.updateStatus],
    ['withdraw team', TeamsController.prototype.remove],
    ['bulk schedule matches', MatchesController.prototype.bulkSchedule],
    ['update match', MatchesController.prototype.update],
    ['update scores', MatchesController.prototype.putScores],
    ['create match', MatchesController.prototype.createManual],
    ['generate bracket', BracketsController.prototype.generate],
    ['set seeds', BracketsController.prototype.updateSeeds],
    ['advance round', BracketsController.prototype.advance],
    [
      'advance Swiss round',
      BracketsController.prototype.generateNextSwissRound,
    ],
    ['delete round', BracketsController.prototype.remove],
    ['create comment or reply', CommentController.prototype.create],
    ['hide comment', CommentController.prototype.hide],
    ['delete comment', CommentController.prototype.remove],
    ['create report', ReportController.prototype.create],
    [
      'send organizer notification',
      NotificationController.prototype.createForTournament,
    ],
  ])('%s checks JWT before verified email', (_name, method) => {
    expectVerifiedAfterJwt(method);
  });

  it('checks verified email before admin role authorization', () => {
    expectVerifiedAfterJwt(AdminController);
  });

  it.each([
    ['team logo', UploadController.prototype.teamLogo],
    ['member avatar', UploadController.prototype.memberAvatar],
    ['tournament banner', UploadController.prototype.banner],
  ])(
    '%s upload inherits JWT and adds verified email first',
    (_name, method) => {
      expect(guards(UploadController)?.[0]).toBe(JwtAuthGuard);
      expect(guards(method)?.[0]).toBe(EmailVerifiedGuard);
    },
  );

  it.each([
    ['verify email', AuthController.prototype.verifyEmail],
    ['resend verification', AuthController.prototype.resendVerification],
    ['forgot password', AuthController.prototype.forgotPassword],
    ['reset password', AuthController.prototype.resetPassword],
    ['confirm email change', AuthController.prototype.confirmEmailChange],
    ['logout', AuthController.prototype.logout],
    ['view current auth user', AuthController.prototype.getMe],
    ['request an email change', AuthController.prototype.requestEmailChange],
  ])('%s is not blocked by EmailVerifiedGuard', (_name, method) => {
    expect(guards(method) ?? []).not.toContain(EmailVerifiedGuard);
  });

  it.each([
    ['tournament list', TournamentsController.prototype.findAll],
    ['tournament detail', TournamentsController.prototype.findBySlug],
    ['standings', TournamentsController.prototype.standings],
    ['schedule', TournamentsController.prototype.schedule],
    ['bracket', TournamentsController.prototype.bracket],
    ['team list', TeamsController.prototype.findByTournament],
    ['team detail', TeamsController.prototype.findOne],
    ['comments', CommentController.prototype.findByTournament],
    ['match detail', MatchesController.prototype.findOne],
    ['round bracket', BracketsController.prototype.getBracket],
  ])('%s public read is unaffected', (_name, method) => {
    expect(guards(method) ?? []).not.toContain(EmailVerifiedGuard);
  });

  it.each([
    ['read own notifications', NotificationController.prototype.findMine],
    ['read unread count', NotificationController.prototype.unreadCount],
    [
      'mark all notifications read',
      NotificationController.prototype.markAllRead,
    ],
    ['mark one notification read', NotificationController.prototype.markRead],
    ['upload own avatar', UploadController.prototype.avatar],
  ])('%s remains available without verified-email policy', (_name, method) => {
    expect(guards(method) ?? []).not.toContain(EmailVerifiedGuard);
  });
});
