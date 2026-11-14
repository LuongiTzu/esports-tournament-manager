import { ValidationPipe } from '@nestjs/common';
import { GoogleLoginDto } from '../auth/dto/google-login.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { PutMatchScoresDto } from '../matches/dto/match.dto';
import { CreateTournamentDto } from '../tournaments/dto/create-tournament.dto';
import { TournamentListQueryDto } from '../tournaments/dto/tournament-list-query.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('request input limits', () => {
  it('rejects credentials larger than the supported login formats', async () => {
    await expect(
      pipe.transform(
        { email: 'user@example.com', password: 'x'.repeat(51) },
        { type: 'body', metatype: LoginDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      pipe.transform(
        { credential: 'x'.repeat(4097) },
        { type: 'body', metatype: GoogleLoginDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects too many score records before match processing', async () => {
    await expect(
      pipe.transform(
        {
          scores: Array.from({ length: 10 }, (_, index) => ({
            setNumber: index + 1,
            teamAScore: 1,
            teamBScore: 0,
          })),
        },
        { type: 'body', metatype: PutMatchScoresDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects malformed round settings', async () => {
    await expect(
      pipe.transform(
        { rounds: [{ name: 'Final', format: 'PLAYOFF', settings: 'invalid' }] },
        { type: 'body', metatype: CreateTournamentDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects oversized search terms', async () => {
    await expect(
      pipe.transform(
        { search: 'x'.repeat(101) },
        { type: 'query', metatype: TournamentListQueryDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
