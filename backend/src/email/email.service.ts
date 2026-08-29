import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { emailTemplates, type RenderedEmail } from './email.templates';

export class EmailDeliveryError extends Error {
  constructor() {
    super('Không thể gửi email');
  }
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const port = Number(this.config.getOrThrow<string>('SMTP_PORT'));
    const secure =
      this.config.getOrThrow<string>('SMTP_SECURE').toLowerCase() === 'true';
    if (!Number.isInteger(port) || port <= 0) {
      throw new EmailDeliveryError();
    }
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port,
      secure,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_APP_PASSWORD'),
      },
    });
    return this.transporter;
  }

  sendVerification(
    to: string,
    displayName: string,
    url: string,
    resent = false,
  ) {
    return this.send(
      to,
      resent
        ? emailTemplates.resendVerification({
            displayName,
            url,
            expiresLabel: '24 giờ',
          })
        : emailTemplates.verifyEmail({
            displayName,
            url,
            expiresLabel: '24 giờ',
          }),
    );
  }

  sendPasswordReset(to: string, displayName: string, url: string) {
    return this.send(
      to,
      emailTemplates.resetPassword({
        displayName,
        url,
        expiresLabel: '15 phút',
      }),
    );
  }

  sendPasswordChanged(to: string, displayName: string) {
    return this.send(to, emailTemplates.passwordChanged(displayName));
  }

  sendEmailChangeConfirmation(to: string, displayName: string, url: string) {
    return this.send(
      to,
      emailTemplates.emailChangeRequest({
        displayName,
        url,
        expiresLabel: '24 giờ',
        newEmail: to,
      }),
    );
  }

  sendEmailChangeRequestedNotice(
    to: string,
    displayName: string,
    newEmail: string,
  ) {
    return this.send(
      to,
      emailTemplates.emailChangeRequest({
        displayName,
        url: '',
        expiresLabel: '24 giờ',
        oldEmail: to,
        newEmail,
      }),
    );
  }

  sendEmailChanged(
    to: string,
    displayName: string,
    oldEmail: string,
    newEmail: string,
  ) {
    return this.send(
      to,
      emailTemplates.emailChanged(displayName, oldEmail, newEmail),
    );
  }

  sendActivity(
    to: string,
    input: {
      displayName: string;
      title: string;
      paragraphs: string[];
      action?: { label: string; url: string };
    },
  ) {
    return this.send(to, emailTemplates.activity(input));
  }

  private async send(to: string, content: RenderedEmail): Promise<void> {
    try {
      await this.getTransporter().sendMail({
        from: this.config.getOrThrow<string>('EMAIL_FROM'),
        to,
        ...content,
      });
    } catch {
      this.logger.error(
        'SMTP delivery failed; credentials and message content were omitted',
      );
      throw new EmailDeliveryError();
    }
  }
}
