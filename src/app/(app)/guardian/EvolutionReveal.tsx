"use client";

import { useState, useEffect } from "react";

type EvolutionResult = {
  guardian_type_id: number;
  name: string;
  rarity: string;
  asset_key: string;
  achievement_rate: number;
  is_duplicate: boolean;
  duplicate_gold: number;
  period_days: number;
};

const RARITY_CONFIG: Record<string, { label: string; color: string; glow: string }> = {
  normal: { label: "노말", color: "#8a8a8a", glow: "rgba(138,138,138,0.4)" },
  rare: { label: "레어", color: "#4a90d9", glow: "rgba(74,144,217,0.4)" },
  epic: { label: "에픽", color: "#9b59b6", glow: "rgba(155,89,182,0.4)" },
  unique: { label: "유니크", color: "#f1c40f", glow: "rgba(241,196,15,0.4)" },
};

type Phase = "cracking" | "flash" | "reveal";

export default function EvolutionReveal({
  result,
  onClose,
}: {
  result: EvolutionResult;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("cracking");
  const rarity = RARITY_CONFIG[result.rarity] || RARITY_CONFIG.normal;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("flash"), 1500);
    const t2 = setTimeout(() => setPhase("reveal"), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: "var(--theme-bg)" }}
    >
      {/* 알 깨지는 단계 */}
      {phase === "cracking" && (
        <div className="flex flex-col items-center gap-4">
          <div className="animate-egg-crack">
            <img
              src="/ui/icons/egg.png"
              alt="알"
              className="pixel-art"
              style={{ width: 80, height: 80 }}
            />
          </div>
          <p className="font-pixel text-sm text-theme animate-pulse">알이 부화하고 있어요...</p>
        </div>
      )}

      {/* 빛 효과 */}
      {phase === "flash" && (
        <div className="animate-flash-pulse flex items-center justify-center">
          <div
            className="h-40 w-40 rounded-full"
            style={{
              background: `radial-gradient(circle, ${rarity.color}88 0%, transparent 70%)`,
            }}
          />
        </div>
      )}

      {/* 가디언 공개 */}
      {phase === "reveal" && (
        <div className="animate-reveal-in flex flex-col items-center gap-4 px-6">
          {/* 가디언 이미지 */}
          <div
            className="pixel-input flex h-36 w-36 items-center justify-center"
            style={{
              boxShadow: `0 0 30px ${rarity.glow}, 0 0 60px ${rarity.glow}`,
            }}
          >
            <img
              src={`/ui/guardi/guardian/${result.asset_key}.png`}
              alt={result.name}
              className="pixel-art"
              style={{ width: 80, height: 80 }}
            />
          </div>

          {/* 레어도 뱃지 */}
          <span
            className="font-pixel text-sm px-4 py-1"
            style={{
              color: rarity.color,
              border: `2px solid ${rarity.color}`,
              borderRadius: "4px",
              textShadow: `0 0 6px ${rarity.color}80`,
            }}
          >
            {rarity.label}
          </span>

          {/* 이름 */}
          <p className="font-pixel text-lg text-theme">{result.name}</p>

          {/* 달성률 */}
          <p className="font-pixel text-xs text-theme-muted">
            {result.period_days}일 육성 · 달성률 {Math.round(result.achievement_rate)}%
          </p>

          {/* 중복 보상 */}
          {result.is_duplicate && (
            <div className="pixel-panel px-4 py-2 text-center">
              <p className="font-pixel text-xs text-theme-muted">이미 보유한 가디언이에요</p>
              <p className="font-pixel text-sm" style={{ color: "var(--theme-gold)" }}>
                +{result.duplicate_gold}G 보상!
              </p>
            </div>
          )}

          {/* 확인 버튼 */}
          <button
            onClick={onClose}
            className="pixel-button mt-4 w-full max-w-[200px] py-3 font-pixel text-sm text-theme"
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
