import { ValidationPipe } from '@nestjs/common';
import { RegisterTeamDto } from './register-team.dto';

describe('RegisterTeamDto representative contacts', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validPayload = {
    name: 'Test Team',
    contactName: 'Representative',
    contactEmail: 'representative@example.com',
    contactPhone: '0900000000',
    members: [{ realName: 'Player One', ign: 'player-one' }],
  };

  const validate = (payload: Record<string, unknown>) =>
    pipe.transform(payload, { type: 'body', metatype: RegisterTeamDto });

  it('accepts members without individual contact information', async () => {
    await expect(validate(validPayload)).resolves.toMatchObject(validPayload);
  });

  it('normalizes blank optional member contacts to omitted values', async () => {
    const result = await validate({
      ...validPayload,
      members: [
        {
          realName: 'Player One',
          ign: 'player-one',
          email: '',
          phoneNumber: ' ',
        },
      ],
    });

    expect(result.members[0].email).toBeUndefined();
    expect(result.members[0].phoneNumber).toBeUndefined();
  });

  it.each(['contactName', 'contactEmail', 'contactPhone'])(
    'rejects a missing %s',
    async (field) => {
      const payload = { ...validPayload };
      delete payload[field as keyof typeof payload];
      await expect(validate(payload)).rejects.toMatchObject({ status: 400 });
    },
  );

  it.each(['contactName', 'contactPhone'])(
    'rejects blank whitespace in %s',
    async (field) => {
      await expect(
        validate({ ...validPayload, [field]: '   ' }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
});
