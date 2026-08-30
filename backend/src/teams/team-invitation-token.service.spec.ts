import { TeamInvitationTokenService } from './team-invitation-token.service';

describe('TeamInvitationTokenService', () => {
  const service = new TeamInvitationTokenService();

  it('creates an opaque token and stores only its SHA-256 hash', () => {
    const created = service.create();

    expect(created.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(created.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.hash).not.toContain(created.token);
    expect(service.matches(created.token, created.hash)).toBe(true);
  });

  it('rejects a different token in constant-length comparison', () => {
    const created = service.create();

    expect(service.matches(`${created.token}x`, created.hash)).toBe(false);
  });
});
