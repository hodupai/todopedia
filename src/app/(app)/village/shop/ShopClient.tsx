"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getShopItems, buyItem } from "./actions";
import type { ShopItem } from "./actions";
import { useGold } from "@/components/GoldProvider";
import { useToast } from "@/components/Toast";

const CATEGORIES = [
  { key: "food", label: "음식", icon: "🍞" },
  { key: "play", label: "놀이", icon: "⚽" },
  { key: "hygiene", label: "위생", icon: "🛁" },
  { key: "sleep", label: "수면", icon: "😴" },
] as const;

export default function ShopClient({
  initialCategory,
  initialItems,
}: {
  initialCategory: string;
  initialItems: ShopItem[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [items, setItems] = useState<ShopItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [buying, setBuying] = useState(false);
  const { gold, refresh: refreshGold } = useGold();
  const { show: showToast } = useToast();
  const isFirstRender = useRef(true);

  const loadItems = useCallback(async (cat: string) => {
    setLoading(true);
    const data = await getShopItems(cat);
    setItems(data);
    setLoading(false);
  }, []);

  // 카테고리 변경 시에만 재조회 (초기는 SSR로 이미 있음)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadItems(category);
  }, [category, loadItems]);

  const handleBuy = async (item: ShopItem) => {
    if (gold < item.price) {
      showToast("골드가 부족해요!");
      return;
    }
    setBuying(true);
    const result = await buyItem(item.id);
    if (result.error) {
      showToast(result.error);
    } else {
      showToast(`${item.name} 구매!`, `-${item.price}G`);
      refreshGold();
      loadItems(category);
    }
    setBuying(false);
    setSelectedItem(null);
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
        <h1 className="font-pixel text-sm text-theme">가디용품점</h1>
      </div>

      {/* 카테고리 탭 */}
      <div className="grid grid-cols-4 gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`pixel-button flex flex-col items-center gap-0.5 py-2 font-pixel text-xs ${
              category === c.key ? "text-theme" : "text-theme-muted"
            }`}
            style={category === c.key ? { opacity: 1 } : { opacity: 0.5 }}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* 아이템 목록 */}
      <div className="pixel-panel flex-1 overflow-y-auto scrollbar-hide p-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <p className="font-pixel text-xs text-theme-muted">로딩 중...</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="pixel-input flex flex-col items-center gap-1 p-2"
              >
                <div className="relative">
                  <img
                    src={`/ui/items/${item.asset_key}.png`}
                    alt={item.name}
                    className="pixel-art"
                    style={{ width: 32, height: 32 }}
                  />
                  {item.collected && (
                    <span
                      className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center font-pixel text-[6px]"
                      style={{ backgroundColor: "var(--theme-accent)", color: "#fff", borderRadius: "2px" }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                <span className="font-pixel text-xs text-theme leading-tight">{item.name}</span>
                <span className="font-pixel text-xs" style={{ color: "var(--theme-gold)" }}>
                  {item.price}G
                </span>
                {item.owned > 0 && (
                  <span className="font-pixel text-[10px] text-theme-muted">
                    소지 {item.owned}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 구매 모달 */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="pixel-panel w-full max-w-[280px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3">
              <img
                src={`/ui/items/${selectedItem.asset_key}.png`}
                alt={selectedItem.name}
                className="pixel-art"
                style={{ width: 48, height: 48 }}
              />
              <p className="font-pixel text-sm text-theme">{selectedItem.name}</p>
              <p className="font-pixel text-xs" style={{ color: "var(--theme-gold)" }}>
                {selectedItem.price}G
              </p>
              {selectedItem.collected && (
                <span className="font-pixel text-[10px] text-theme-muted">도감 등록됨</span>
              )}
              {selectedItem.owned > 0 && (
                <span className="font-pixel text-[10px] text-theme-muted">
                  소지 {selectedItem.owned}개
                </span>
              )}
              <div className="flex w-full gap-2">
                <button
                  onClick={() => handleBuy(selectedItem)}
                  disabled={buying}
                  className="pixel-button flex-1 py-2 font-pixel text-xs text-theme"
                >
                  {buying ? "구매 중..." : "구매"}
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
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
