import { emailTemplates } from './email.templates';

describe('activity email template', () => {
  it('escapes user-controlled content in HTML while preserving readable text', () => {
    const rendered = emailTemplates.activity({
      displayName: '<Player>',
      title: 'Thông báo <quan trọng>',
      paragraphs: ['Đội <script>alert(1)</script> đã được duyệt.'],
      action: {
        label: 'Xem & kiểm tra',
        url: 'http://localhost:3000/tournaments/cup?a=1&b=2',
      },
    });

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('a=1&amp;b=2');
    expect(rendered.text).toContain('<script>alert(1)</script>');
  });
});
