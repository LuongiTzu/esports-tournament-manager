import type { GeminiErrorCode } from '../../ai/gemini.service';

const messages: Record<'vi' | 'en', Record<GeminiErrorCode, string>> = {
  vi: {
    NOT_CONFIGURED:
      'Arena chưa được cấu hình kết nối Gemini. Người quản trị cần kiểm tra cấu hình AI.',
    UNAUTHORIZED:
      'Gemini từ chối quyền truy cập. Người quản trị cần kiểm tra API key và quyền sử dụng model.',
    RATE_LIMITED:
      'Gemini đang giới hạn lượt gọi hoặc đã hết quota. Bạn thử lại sau nhé.',
    TIMEOUT:
      'Gemini phản hồi quá lâu. Arena đã thử lại nhưng chưa nhận được kết quả; bạn gửi lại sau một chút nhé.',
    INVALID_REQUEST:
      'Gemini không chấp nhận cấu hình yêu cầu hiện tại. Người quản trị cần kiểm tra model và cấu trúc yêu cầu AI.',
    UNAVAILABLE:
      'Gemini hoặc kết nối tới Gemini đang gặp sự cố tạm thời. Arena đã thử lại nhưng chưa thành công; bạn thử lại sau nhé.',
    INVALID_RESPONSE:
      'Gemini trả về phản hồi không hợp lệ. Bạn thử gửi lại câu hỏi nhé.',
  },
  en: {
    NOT_CONFIGURED:
      'Arena is not configured for Gemini. An administrator needs to check the AI configuration.',
    UNAUTHORIZED:
      'Gemini denied access. An administrator needs to check the API key and model permissions.',
    RATE_LIMITED:
      'Gemini has reached a rate or quota limit. Please try again later.',
    TIMEOUT:
      'Gemini took too long to respond. Arena retried without receiving a result; please try again shortly.',
    INVALID_REQUEST:
      'Gemini rejected the request configuration. An administrator needs to check the model and request schema.',
    UNAVAILABLE:
      'Gemini or the connection to it is temporarily unavailable. Arena retried without success; please try again later.',
    INVALID_RESPONSE:
      'Gemini returned an invalid response. Please send your question again.',
  },
};

export function assistantErrorMessage(
  code: GeminiErrorCode,
  locale: 'vi' | 'en',
) {
  return messages[locale][code];
}
