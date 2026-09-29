"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            background: "#0f172a",
            color: "#f8fafc",
          }}
        >
          <section style={{ maxWidth: "32rem", textAlign: "center" }}>
            <h1>Ứng dụng đang gặp sự cố</h1>
            <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
              Không thể hiển thị trang vào lúc này. Vui lòng thử tải lại ứng dụng.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1rem",
                border: 0,
                borderRadius: "0.5rem",
                padding: "0.75rem 1.25rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Thử lại
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
