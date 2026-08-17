# UI image library

Đặt ảnh thiết kế trong thư mục tương ứng bên dưới. Mọi tệp trong `public` được
Next.js phục vụ từ URL gốc, vì vậy không thêm `public` vào đường dẫn sử dụng.

## Cấu trúc

```text
public/images/
├── global/                    Logo, favicon nguồn, texture và nền dùng toàn app
├── home/
│   ├── hero/                  Ảnh chính của Hero
│   ├── discovery/             Ảnh khu khám phá giải đấu
│   ├── operation/             Ảnh ba bước điều hành
│   ├── formats/               Ảnh/minh họa các thể thức
│   └── benefits/              Ảnh khu lợi ích nền tảng
├── auth/
│   ├── login/                 Trang đăng nhập
│   └── register/              Trang đăng ký
├── tournaments/
│   ├── common/                Ảnh dùng chung cho nhiều trang giải đấu
│   ├── create/                Trang tạo giải
│   ├── detail/                Trang chi tiết giải
│   ├── manage/                Trang quản lý giải
│   └── register-team/         Trang đăng ký đội
└── profile/                   Trang hồ sơ/Giải của tôi
```

## Quy ước

- Ưu tiên `webp` hoặc `avif`; dùng `png` khi cần nền trong suốt.
- Đặt tên chữ thường dạng kebab-case, ví dụ `tournament-crowd.jpg`.
- Không ghi đè một ảnh bằng nội dung khác nếu ảnh đó đang được sử dụng; đổi tên
  để cache trình duyệt được cập nhật chính xác.
- Không để ảnh chứa thông tin bí mật hoặc dữ liệu người dùng trong `public`.
- Với ảnh nội dung, luôn cung cấp `alt`. Ảnh chỉ để trang trí nên dùng `alt=""`.

## Sử dụng trong component

```tsx
import Image from "next/image";

<Image
  src="/images/home/hero/tournament-crowd.jpg"
  alt="Khán giả theo dõi một giải đấu esports"
  width={630}
  height={420}
  priority
/>
```

Khi thêm ảnh, hãy gửi tên file hoặc đường dẫn cho Codex, ví dụ:
`frontend/public/images/home/hero/tournament-crowd.jpg`.
