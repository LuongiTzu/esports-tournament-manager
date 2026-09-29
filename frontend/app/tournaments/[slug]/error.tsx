"use client";

import RouteErrorState from "@/components/errors/RouteErrorState";

export default function TournamentError({ reset }: { reset: () => void }) {
  return (
    <RouteErrorState
      reset={reset}
      title="Không thể tải giải đấu"
      description="Dữ liệu giải đấu chưa tải được. Hãy thử lại; nếu lỗi vẫn còn, quay về trang chủ để tiếp tục."
    />
  );
}
