import { ReportReason } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateReportDto } from './create-report.dto';

describe('CreateReportDto', () => {
  it.each([
    ReportReason.MINOR_SAFETY,
    ReportReason.HARASSMENT_OR_HATE,
    ReportReason.VIOLENCE_OR_SELF_HARM,
    ReportReason.RESTRICTED_GOODS,
    ReportReason.ADULT_CONTENT,
    ReportReason.INTELLECTUAL_PROPERTY,
    ReportReason.SPAM_OR_MALICIOUS_LINKS,
  ])('accepts the expanded report reason %s', async (reason) => {
    const dto = Object.assign(new CreateReportDto(), { reason });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
