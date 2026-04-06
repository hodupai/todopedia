"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getPotions, buyPotion } from "./actions";
import type { PotionItem } from "./actions";
import { useGold } from "@/components/GoldProvider";
import { useToast } from "@/components/Toast";

function formatMult(mult: number): string {
  if (mult === 1.0) return "-";
  return `${Math.round((mult - 1) * 100)}% UP`;
}

export default function FortunePage() {
  const router = useRouter();
  const [potions, setPotions] = useState<PotionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PotionItem | null>(null);
  const [buying, setBuying] = useState(false);
  const { gold, refresh: refreshGold } = useGold();
  const { show: showToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getPotions();
    setPotions(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBuy = async (potion: PotionItem) => {
    if (gold < potion.price) {
      showToast("골드가 부족해요!");
      return;
    }
    setBuying(true);
    const result = await buyPotion(potion.id);
    if (result.error) {
      showToast(result.error);
    } else {
      showToast(`${potion.name} 구매!`, `-${potion.price}G`);
      refreshGold();
      loadData();
    }
    setBuying(false);
    setSelected(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="pixel-button px-3 py-1 font-pixel text-xs text-theme"
        >
          ←
        </button>
        <h1 className="font-pixel text-sm text-theme">점술관</h1>
      </div>

      <p className="font-pixel text-xs text-theme-muted">
        진화 시 사용할 수 있는 물약을 판매합니다.
      </p>

      {/* 포션 목록 */}
      <div className="pixel-panel flex-1 overflow-y-auto scrollbar-hide p-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <p className="font-pixel text-xs text-theme-muted">로딩 중...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {potions.map((potion) => (
              <button
                key={potion.id}
                onClick={() => setSelected(potion)}
                className="pixel-input flex w-full items-center gap-3 p-3"
              >
                <img
                  src={`/ui/items/${potion.asset_key}.png`}
                  alt={potion.name}
                  className="pixel-art shrink-0"
                  style={{ width: 32, height: 32 }}
                />
                <div className="flex-1 text-left">
                  <p className="font-pixel text-sm text-theme">{potion.name}</p>
                  <p className="font-pixel text-xs text-theme-muted">{potion.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-pixel text-sm" style={{ color: "var(--theme-gold)" }}>
                    {potion.price}G
                  </p>
                  {potion.owned > 0 && (
                    <p className="font-pixel text-xs text-theme-muted">x{potion.owned}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 구매 모달 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="pixel-panel w-full max-w-[300px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3">
              <img
                src={`/ui/items/${selected.asset_key}.png`}
                alt={selected.name}
                className="pixel-art"
                style={{ width: 48, height: 48 }}
              />
              <p className="font-pixel text-sm text-theme">{selected.name}</p>
              <p className="font-pixel text-xs text-theme-muted text-center">
                {selected.description}
              </p>

              {/* 효과 상세 */}
              {!selected.normal_guarantee && (
                <div className="w-full space-y-1">
                  {selected.rare_mult > 1 && (
                    <div className="flex justify-between font-pixel text-xs">
                      <span style={{ color: "#4a90d9" }}>레어</span>
                      <span className="text-theme">{formatMult(selected.rare_mult)}</span>
                    </div>
                  )}
                  {selected.epic_mult > 1 && (
                    <div className="flex justify-between font-pixel text-xs">
                      <span style={{ color: "#9b59b6" }}>에픽</span>
                      <span className="text-theme">{formatMult(selected.epic_mult)}</span>
                    </div>
                  )}
                  {selected.unique_mult > 1 && (
                    <div className="flex justify-between font-pixel text-xs">
                      <span style={{ color: "#f1c40f" }}>유니크</span>
                      <span className="text-theme">{formatMult(selected.unique_mult)}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="font-pixel text-xs" style={{ color: "var(--theme-gold)" }}>
                {selected.price}G
              </p>
              {selected.owned > 0 && (
                <p className="font-pixel text-[10px] text-theme-muted">소지 {selected.owned}개</p>
              )}

              <div className="flex w-full gap-2">
                <button
                  onClick={() => handleBuy(selected)}
                  disabled={buying}
                  className="pixel-button flex-1 py-2 font-pixel text-xs text-theme"
                >
                  {buying ? "구매 중..." : "구매"}
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
