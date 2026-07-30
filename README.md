<div align="center">

# 🎮 Esports Tournament Manager

**Nền tảng tạo, quản lý và tổ chức giải đấu Esports đối kháng**

![Next.js](https://img.shields.io/badge/Frontend-Next.js-black?logo=next.js)
![NestJS](https://img.shields.io/badge/Backend-NestJS-E0234E?logo=nestjs)
![Socket.IO](https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql)
![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?logo=docker)

</div>

---

## 📖 Giới thiệu

Thị trường Esports (LOL, Valorant, CS:GO, FC Online, Liên Quân Mobile...) tại Việt Nam và thế giới đang phát triển mạnh, kéo theo nhu cầu tổ chức giải đấu từ quy mô nhỏ (nội bộ trường học, quán net, câu lạc bộ) đến quy mô lớn (giải cộng đồng, giải bán chuyên). Tuy nhiên phần lớn đơn vị tổ chức vừa và nhỏ vẫn quản lý giải đấu thủ công qua Excel, Google Sheet hoặc Discord, dẫn đến nhiều bất cập:

- Khó theo dõi sơ đồ nhánh đấu (bracket) khi số đội lớn, đặc biệt với thể thức nhánh thắng – nhánh thua.
- Khán giả không có nơi tra cứu tập trung tỉ số, lịch thi đấu, bảng xếp hạng.
- Không kiểm soát được việc đăng ký đội tham gia, dễ xảy ra gian lận thông tin.
- Không có cơ chế giám sát nội dung, dễ bị lợi dụng để cá độ trái phép núp bóng giải đấu.

**Esports Tournament Manager** ra đời nhằm giải quyết các vấn đề trên — một nền tảng web tập trung giúp Ban tổ chức tạo lập và vận hành giải đấu bài bản, đồng thời cho phép khán giả theo dõi công khai mà không cần đăng nhập.

> ⚠️ **Phạm vi:** Chỉ hỗ trợ các game đối kháng 2 phe (đội với đội, hoặc cá nhân với cá nhân) — LOL, Dota 2, Liên Quân Mobile, Valorant, CS:GO, FC Online... **Không hỗ trợ** thể loại battle royale (PUBG, Fortnite, Free Fire...).

---

## ✨ Tính năng nổi bật

### 🏆 Quản lý giải đấu đa thể thức, nhiều Round
Một giải đấu có thể gồm nhiều Round, mỗi Round chọn độc lập một thể thức:
- Vòng tròn (Round Robin)
- Vòng bảng (Group Stage)
- Vòng Thụy Sĩ (Swiss Stage)
- Playoff (loại trực tiếp — Single Elimination)
- Nhánh thắng – Nhánh thua (Double Elimination)

Sơ đồ nhánh đấu (bracket) và cặp đấu được **tự động sinh** dựa trên số đội và thể thức đã chọn cho từng Round.

### 📊 Xem thông tin giải đấu
- Trang chi tiết giải đấu: thông tin chung, thể lệ, thời gian.
- Sơ đồ bracket trực quan theo từng Round.
- Lịch thi đấu, tỉ số từng trận, bảng xếp hạng.
- Danh sách đội tham gia và thành viên từng đội.

### 🔗 Chia sẻ Public / Private
- **Public:** chia sẻ link công khai, ai cũng xem được tỉ số, thông tin đội, lịch thi đấu, thể thức, vòng đấu — **không cần đăng nhập**.
- **Private:** không cho phép chia sẻ/xem qua link công khai.

### 📝 Đăng ký tham gia trực tuyến
Người tham gia đăng ký đội trực tiếp trên web; Ban tổ chức duyệt/từ chối và quản lý danh sách thành viên.

### 🔐 Hệ thống tài khoản & phân quyền (4 vai trò)

| Vai trò | Quyền hạn chính |
|---|---|
| **Admin** | Kiểm soát, kiểm duyệt giải đấu trước khi công khai; giám sát nhằm tránh giải đấu mang tính chất cá độ trái phép |
| **Ban tổ chức (BTC)** | Tạo, quản lý giải đấu; khởi tạo vòng đấu; cập nhật tỉ số; xem thông tin người tham gia; tạo link phòng Discord |
| **Người tham gia / đã đăng ký** | Đăng ký giải; xem thông tin chi tiết (đối thủ, lịch trình); nhận thông báo cho giải mình tham gia; bình luận |
| **Khách vãng lai** | Xem thông tin giải cơ bản qua link public, không cần đăng nhập/đăng ký |

### 🛠️ Vận hành của Ban tổ chức
- Khởi tạo vòng đấu, chọn thể thức cho từng Round.
- Cập nhật tỉ số trận đấu.
- Xem thông tin chi tiết người tham gia.
- Tạo link phòng Discord cho đội tham gia giải.

### 🛡️ Kiểm duyệt nội dung
Admin kiểm soát và kiểm duyệt giải đấu trước khi công khai, giám sát nhằm ngăn chặn các hình thức cá độ trái phép và vi phạm quy định.

### 💬 Bình luận
Cho phép bình luận dưới các giải đấu.

### ⚡ Theo dõi & thông báo thời gian thực
- Trang xem giải đấu (kể cả khách vãng lai) tự động cập nhật tỉ số, lịch thi đấu ngay khi có thay đổi — không cần tải lại trang.
- Người tham gia đã đăng ký nhận thông báo real-time cho giải mình tham gia.
- Bình luận mới cập nhật tức thời cho người đang xem cùng trang.

---

## 🧰 Công nghệ sử dụng

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS | Giao diện người dùng, trang public xem giải đấu, trang quản trị BTC/Admin |
| **Backend** | Node.js (NestJS), Socket.IO | Xử lý nghiệp vụ (API), xác thực, phân quyền, đẩy sự kiện real-time |
| **Cơ sở dữ liệu** | PostgreSQL | Lưu trữ dữ liệu người dùng, giải đấu, đội, trận đấu, bracket, bình luận |
| **Triển khai** | Docker, Docker Compose | Đóng gói và chạy đồng bộ frontend, backend, database |

---

## 🎯 Mục tiêu dự án

1. Xây dựng hệ thống xác thực – phân quyền hoạt động đúng với 4 vai trò.
2. Xây dựng module quản lý giải đấu nhiều Round, mỗi Round chọn độc lập một thể thức, tự sinh bracket/cặp đấu.
3. Cho phép truy cập công khai (không đăng nhập) vào giải đấu Public; giải Private không chia sẻ công khai.
4. Xây dựng luồng đăng ký đội tham gia – duyệt đội giữa Người tham gia và BTC.
5. Tích hợp cập nhật thời gian thực (Socket.IO) cho tỉ số, lịch thi đấu và thông báo.
6. Xây dựng cơ chế kiểm duyệt nội dung cơ bản, phòng chống cá độ trái phép.
7. Đóng gói toàn bộ hệ thống bằng Docker/Docker Compose.
8. Hoàn thành tài liệu mô tả hệ thống, thiết kế CSDL, hướng dẫn triển khai phục vụ báo cáo/nghiệm thu.

---

## 👥 Đối tượng sử dụng

- Ban tổ chức giải đấu Esports quy mô nhỏ/vừa (CLB game, trường học, cộng đồng game thủ).
- Người chơi/đội tuyển muốn đăng ký tham gia thi đấu.
- Khán giả/người hâm mộ muốn theo dõi kết quả giải đấu.

---

<div align="center">

*Tài liệu đang trong giai đoạn phát triển — hướng dẫn cài đặt và chạy dự án sẽ được bổ sung sau.*

</div>
