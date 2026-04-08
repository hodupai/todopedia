import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 클라이언트 라우터 캐시 — 한 번 방문한 탭으로 돌아갈 때 즉시 재사용.
    // Next.js 15부터 dynamic 기본값이 0초로 바뀌어 매 탭 클릭마다 풀 RSC fetch가 발생.
    // 60초 캐시 → 탭 전환이 즉각 반응. 사용자 액션은 optimistic update로 이미 반영됨.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
