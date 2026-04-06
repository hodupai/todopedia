"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getWallPosts, heartPost } from "./actions";
import type { WallPost } from "./actions";
import { useGold } from "@/components/GoldProvider";
import { useToast } from "@/components/Toast";

const RARITY_COLORS: Record<string, string> = {
  normal: "#8a8a8a",
  rare: "#4a90d9",
  epic: "#9b59b6",
  unique: "#f1c40f",
};

const RARITY_LABELS: Record<string, string> = {
  normal: "노말",
  rare: "레어",
  epic: "에픽",
  unique: "유니크",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function VillagePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { refresh: refreshGold } = useGold();
  const { show: showToast } = useToast();

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const data = await getWallPosts();
    setPosts(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleHeart = async (postId: string) => {
    const result = await heartPost(postId);
    if (result.error) {
      showToast(result.error);
    } else {
      showToast("💗 +10G", "상대방도 +10G");
      refreshGold();
      loadPosts();
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 담벼락 */}
      <div className="pixel-panel flex-1 overflow-y-auto scrollbar-hide p-4">
        <h2 className="font-pixel text-sm text-theme">담벼락</h2>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <p className="font-pixel text-xs text-theme-muted">로딩 중...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center py-8">
            <span className="text-3xl">🏘️</span>
            <p className="font-pixel mt-2 text-sm text-theme-muted">아직 소식이 없어요</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="pixel-input p-3">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-xs text-theme">{post.nickname}</span>
                  <span className="font-pixel text-[10px] text-theme-muted">{timeAgo(post.created_at)}</span>
                </div>
                <div className="mt-2">
                  {post.type === "evolution" && post.content.guardian_name && (
                    <div className="flex items-center gap-2">
                      <img
                        src={`/ui/guardi/guardian/${post.content.asset_key}.png`}
                        alt={post.content.guardian_name}
                        className="pixel-art"
                        style={{ width: 32, height: 32 }}
                      />
                      <div>
                        <p className="font-pixel text-xs text-theme">
                          <span className="text-outline-dark" style={{ color: RARITY_COLORS[post.content.rarity || "normal"] }}>
                            [{RARITY_LABELS[post.content.rarity || "normal"]}]
                          </span>
                          {" "}{post.content.guardian_name}을(를) 얻었어요!
                        </p>
                        <p className="font-pixel text-[10px] text-theme-muted">{post.content.period_days}일 육성</p>
                      </div>
                    </div>
                  )}
                  {post.type === "daily_goal" && (
                    <p className="font-pixel text-xs text-theme">오늘의 목표를 달성했어요! 🎉</p>
                  )}
                  {post.type === "achievement" && (
                    <p className="font-pixel text-xs text-theme">업적을 달성했어요! 🏆</p>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => !post.hearted && handleHeart(post.id)}
                    className="flex items-center gap-1 font-pixel text-xs"
                    style={{ color: post.hearted ? "#e74c3c" : "var(--theme-text-muted)" }}
                  >
                    <span>{post.hearted ? "❤️" : "🤍"}</span>
                    <span>{post.heart_count}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상점 바로가기 */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => router.push("/village/shop")}
          className="pixel-button flex flex-col items-center gap-1 py-3"
        >
          <span className="text-lg">🧸</span>
          <span className="font-pixel text-[10px] text-theme">가디용품</span>
        </button>
        <button
          onClick={() => router.push("/village/fortune")}
          className="pixel-button flex flex-col items-center gap-1 py-3"
        >
          <span className="text-lg">🔮</span>
          <span className="font-pixel text-[10px] text-theme">점술관</span>
        </button>
        <button
          className="pixel-button flex flex-col items-center gap-1 py-3"
          style={{ opacity: 0.4 }}
          disabled
        >
          <span className="text-lg">🎨</span>
          <span className="font-pixel text-[10px] text-theme-muted">테마샵</span>
        </button>
        <button
          onClick={() => router.push("/village/party")}
          className="pixel-button flex flex-col items-center gap-1 py-3"
        >
          <span className="text-lg">⚔️</span>
          <span className="font-pixel text-[10px] text-theme">파티관리</span>
        </button>
      </div>
    </div>
  );
}
