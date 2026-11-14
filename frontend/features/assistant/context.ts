import type { AssistantPage } from "./api";
export function assistantPage(path: string): {
  page: AssistantPage;
  slug?: string;
} {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "tournaments") return { page: "general" };
  if (!parts[1]) return { page: "discover" };
  if (parts[1] === "new") return { page: "create" };
  return {
    page: parts.includes("manage") ? "manage" : "tournament",
    slug: decodeURIComponent(parts[1]),
  };
}
export const greetings = {
  vi: {
    discover: {
      hint: "Bạn đang tìm giải đấu? Để Arena giúp nhé!",
      intro:
        "Bạn muốn bước vào giải đấu nào? Kể mình nghe game, thời gian hay thể thức bạn thích. Mình sẽ tìm và cùng bạn chọn giải phù hợp.",
      suggestions: [
        "Tìm giải Liên Quân có Swiss + loại trực tiếp",
        "Có giải nào còn nhận đăng ký?",
        "Swiss khác vòng bảng như thế nào?",
      ],
    },
    tournament: {
      hint: "Có điều gì về giải này bạn muốn hỏi không?",
      intro:
        "Mình đang đồng hành cùng bạn ở giải này. Bạn có thể hỏi thể lệ, hạn đăng ký hoặc lịch đấu của đội mình.",
      suggestions: [
        "Khi nào đóng đăng ký?",
        "Đội tôi thi đấu lúc nào?",
        "Giải này có những giai đoạn nào?",
      ],
    },
    manage: {
      hint: "Cần một trợ lý để điều hành giải?",
      intro:
        "Mình giúp bạn nắm tình hình và chuẩn bị thay đổi cho giải. Bạn cứ mô tả; mình sẽ đưa bản xem trước để bạn duyệt.",
      suggestions: [
        "Tóm tắt tình hình giải và việc cần làm",
        "Có bao nhiêu đội đang chờ duyệt?",
        "Tôi muốn sửa thông tin giải",
      ],
    },
    create: {
      hint: "Có ý tưởng cho giải đấu? Kể Arena nghe nhé!",
      intro:
        "Cùng biến ý tưởng thành một giải đấu nhé. Cho mình biết tên, game, số đội và thể thức. Bạn có thể sửa bản nháp bằng cách trò chuyện.",
      suggestions: [
        "Tạo giải Liên Quân tên Arena Cup, 16 đội, Swiss rồi playoff",
        "Giúp tôi chọn thể thức cho 32 đội",
        "Tạo giải Valorant tên Friday Cup, 8 đội, BO3",
      ],
    },
    general: {
      hint: "Chào bạn! Arena có thể giúp gì hôm nay?",
      intro:
        "Mình là Arena, trợ lý AI chuyên về ArenaVerse, các game trong hệ thống và esports. Mình giúp tìm/tạo giải, giải thích luật thi đấu, tìm hiểu tuyển thủ và tra tin esports. Trong mỗi giải, mình hỗ trợ theo quyền của bạn.",
      suggestions: [
        "Tìm giải đấu cho tôi",
        "Tôi muốn tổ chức một giải",
        "Giải thích Swiss và loại trực tiếp",
      ],
    },
  },
  en: {
    discover: {
      hint: "Looking for a tournament? Let me help!",
      intro:
        "Tell me your game, preferred dates or format. We can explore tournaments together and refine the results.",
      suggestions: [
        "Find tournaments with Swiss and playoffs",
        "Which tournaments accept registrations?",
        "How does Swiss differ from groups?",
      ],
    },
    tournament: {
      hint: "Questions about this tournament?",
      intro:
        "Ask me about the rules, registration deadline or your team’s schedule in this tournament.",
      suggestions: [
        "When does registration close?",
        "When does my team play?",
        "Explain the tournament stages",
      ],
    },
    manage: {
      hint: "Need a hand running your tournament?",
      intro:
        "I can summarize the tournament and prepare changes for you to review before applying.",
      suggestions: [
        "Summarize the tournament and next steps",
        "How many teams await approval?",
        "Help me edit tournament information",
      ],
    },
    create: {
      hint: "Have a tournament idea? Tell Arena!",
      intro:
        "Tell me the name, game, team count and format. We’ll shape a draft together before you save it.",
      suggestions: [
        "Create Friday Cup for Valorant, 8 teams, BO3 playoffs",
        "Help me choose a format for 32 teams",
        "Create Arena Cup with 16 teams, Swiss then playoffs",
      ],
    },
    general: {
      hint: "Hi! What can Arena help you with?",
      intro:
        "I’m Arena, your AI companion for ArenaVerse, its games and esports. I help with tournaments, competitive rules, players and esports news. Open a tournament for answers based on your access.",
      suggestions: [
        "Find a tournament for me",
        "Help me organize a tournament",
        "Explain Swiss and single elimination",
      ],
    },
  },
};
