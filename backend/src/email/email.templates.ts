export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface LinkTemplateInput {
  displayName: string;
  url: string;
  expiresLabel: string;
}

interface ActivityTemplateInput {
  displayName: string;
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
}

const BRAND = 'ArenaVerse';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });
}

function layout(
  title: string,
  greeting: string,
  paragraphs: string[],
  action?: { label: string; url: string },
): string {
  const safeTitle = escapeHtml(title);
  const safeGreeting = escapeHtml(greeting);
  const safeParagraphs = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.65;color:#3f3438">${escapeHtml(paragraph)}</p>`,
    )
    .join('');
  const actionMarkup = action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;border-radius:999px;background:#4a081c;color:#fff8fa;padding:14px 24px;font-weight:700;text-decoration:none">${escapeHtml(action.label)}</a></p><p style="margin:0 0 8px;color:#706368;font-size:13px">Nếu nút không hoạt động, hãy sao chép URL sau:</p><p style="margin:0;word-break:break-all;color:#861536;font-size:13px">${escapeHtml(action.url)}</p>`
    : '';

  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f4f2eb;font-family:Arial,sans-serif;color:#211c1e"><div style="max-width:640px;margin:0 auto;padding:32px 16px"><div style="border:1px solid #e1d8db;border-radius:18px;background:#fff;padding:32px"><p style="margin:0 0 12px;color:#a10f3b;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">${BRAND}</p><h1 style="margin:0 0 24px;font-size:26px">${safeTitle}</h1><p style="margin:0 0 16px;line-height:1.65;color:#3f3438">${safeGreeting}</p>${safeParagraphs}${actionMarkup}<p style="margin:28px 0 0;border-top:1px solid #eee3e6;padding-top:20px;color:#82757a;font-size:12px">Email thông báo tự động từ ${BRAND}. Vui lòng không trả lời email này.</p></div></div></body></html>`;
}

function linkText(
  greeting: string,
  paragraphs: string[],
  label: string,
  url: string,
): string {
  return [`${BRAND}`, greeting, ...paragraphs, `${label}: ${url}`].join('\n\n');
}

function verification(
  input: LinkTemplateInput,
  resent: boolean,
): RenderedEmail {
  const title = resent ? 'Gửi lại xác minh email' : 'Xác minh email của bạn';
  const paragraphs = [
    'Hãy xác minh địa chỉ email để kích hoạt đăng nhập bằng email và mật khẩu.',
    `Liên kết chỉ dùng một lần và hết hạn sau ${input.expiresLabel}. Nếu bạn không tạo tài khoản, có thể bỏ qua email này.`,
  ];
  const greeting = `Xin chào ${input.displayName},`;
  return {
    subject: `[${BRAND}] ${title}`,
    html: layout(title, greeting, paragraphs, {
      label: 'Xác minh email',
      url: input.url,
    }),
    text: linkText(greeting, paragraphs, 'Xác minh email', input.url),
  };
}

export const emailTemplates = {
  activity(input: ActivityTemplateInput): RenderedEmail {
    const greeting = `Xin chào ${input.displayName},`;
    return {
      subject: `[${BRAND}] ${input.title}`,
      html: layout(input.title, greeting, input.paragraphs, input.action),
      text: input.action
        ? linkText(
            greeting,
            input.paragraphs,
            input.action.label,
            input.action.url,
          )
        : [BRAND, greeting, ...input.paragraphs].join('\n\n'),
    };
  },
  verifyEmail: (input: LinkTemplateInput) => verification(input, false),
  resendVerification: (input: LinkTemplateInput) => verification(input, true),
  resetPassword(input: LinkTemplateInput): RenderedEmail {
    const greeting = `Xin chào ${input.displayName},`;
    const paragraphs = [
      'ArenaVerse nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
      `Liên kết chỉ dùng một lần và hết hạn sau ${input.expiresLabel}. Nếu bạn không yêu cầu, hãy bỏ qua email và không chia sẻ liên kết này.`,
    ];
    return {
      subject: `[${BRAND}] Đặt lại mật khẩu`,
      html: layout('Đặt lại mật khẩu', greeting, paragraphs, {
        label: 'Đặt lại mật khẩu',
        url: input.url,
      }),
      text: linkText(greeting, paragraphs, 'Đặt lại mật khẩu', input.url),
    };
  },
  emailChangeRequest(
    input: LinkTemplateInput & { oldEmail?: string; newEmail: string },
  ): RenderedEmail {
    const greeting = `Xin chào ${input.displayName},`;
    const paragraphs = input.oldEmail
      ? [
          `ArenaVerse nhận được yêu cầu đổi email đăng nhập từ ${input.oldEmail} sang ${input.newEmail}.`,
          `Để hoàn tất, hãy xác nhận tại email mới trong ${input.expiresLabel}. Nếu bạn không yêu cầu, hãy đổi mật khẩu ngay.`,
        ]
      : [
          `ArenaVerse nhận được yêu cầu dùng ${input.newEmail} làm email đăng nhập mới.`,
          `Liên kết chỉ dùng một lần và hết hạn sau ${input.expiresLabel}. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
        ];
    const action = input.oldEmail
      ? undefined
      : { label: 'Xác nhận email mới', url: input.url };
    return {
      subject: `[${BRAND}] Yêu cầu đổi email`,
      html: layout('Yêu cầu đổi email', greeting, paragraphs, action),
      text: action
        ? linkText(greeting, paragraphs, action.label, action.url)
        : [BRAND, greeting, ...paragraphs].join('\n\n'),
    };
  },
  passwordChanged(displayName: string): RenderedEmail {
    const greeting = `Xin chào ${displayName},`;
    const paragraphs = [
      'Mật khẩu tài khoản ArenaVerse của bạn vừa được thay đổi và các phiên đăng nhập cũ đã bị vô hiệu hóa.',
      'Nếu bạn không thực hiện thay đổi này, hãy đặt lại mật khẩu ngay và liên hệ bộ phận hỗ trợ.',
    ];
    return {
      subject: `[${BRAND}] Mật khẩu của bạn đã được thay đổi`,
      html: layout('Mật khẩu đã thay đổi', greeting, paragraphs),
      text: [BRAND, greeting, ...paragraphs].join('\n\n'),
    };
  },
  emailChanged(
    displayName: string,
    oldEmail: string,
    newEmail: string,
  ): RenderedEmail {
    const greeting = `Xin chào ${displayName},`;
    const paragraphs = [
      `Email đăng nhập ArenaVerse đã được đổi từ ${oldEmail} sang ${newEmail}.`,
      'Các phiên đăng nhập cũ đã bị vô hiệu hóa. Nếu bạn không thực hiện thay đổi này, hãy liên hệ bộ phận hỗ trợ ngay.',
    ];
    return {
      subject: `[${BRAND}] Email đăng nhập đã được thay đổi`,
      html: layout('Email đã thay đổi', greeting, paragraphs),
      text: [BRAND, greeting, ...paragraphs].join('\n\n'),
    };
  },
};
