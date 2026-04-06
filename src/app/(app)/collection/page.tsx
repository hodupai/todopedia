"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getGuardianTypes, getCollection, getCollectionSummary,
  getItemTypes, getItemCollection, getItemCollectionSummary,
} from "./actions";
import type { GuardianType, CollectionItem, ItemType } from "./actions";

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

const TABS = ["가디 도감", "아이템 도감"] as const;

const ITEM_CATEGORIES = [
  { key: "food", label: "음식", icon: "🍞" },
  { key: "play", label: "놀이", icon: "⚽" },
  { key: "hygiene", label: "위생", icon: "🛁" },
  { key: "sleep", label: "수면", icon: "😴" },
] as const;

export default function CollectionPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("가디 도감");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 메인 탭 */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pixel-button flex-1 py-2 font-pixel text-xs ${
              tab === t ? "text-theme" : "text-theme-muted"
            }`}
            style={tab === t ? { opacity: 1 } : { opacity: 0.6 }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "가디 도감" ? <GuardianCollection /> : <ItemCollection />}
    </div>
  );
}

// ── 가디 도감 ──
function GuardianCollection() {
  const [types, setTypes] = useState<GuardianType[]>([]);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [summary, setSummary] = useState({ collected: 0, total: 0 });
  const [selectedType, setSelectedType] = useState<GuardianType | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [typesData, itemsData, summaryData] = await Promise.all([
      getGuardianTypes(1),
      getCollection(1),
      getCollectionSummary(1),
    ]);
    setTypes(typesData);
    setItems(itemsData);
    setSummary(summaryData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const collectedIds = new Set(items.map((i) => i.guardian_type_id));
  const getCount = (typeId: number) => items.filter((i) => i.guardian_type_id === typeId).length;
  const getLatest = (typeId: number) => items.find((i) => i.guardian_type_id === typeId);

  return (
    <>
      <div className="pixel-panel flex-1 p-4">
        <div className="flex items-center justify-between font-pixel">
          <span className="text-sm text-theme">시즌 1</span>
          <span className="text-xs text-theme-muted">
            {loading ? "..." : `${summary.collected} / ${summary.total}`}
          </span>
        </div>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <p className="font-pixel text-xs text-theme-muted">로딩 중...</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-3">
            {types.map((type) => {
              const collected = collectedIds.has(type.id);
              const count = getCount(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => collected ? setSelectedType(type) : undefined}
                  className="pixel-input relative flex aspect-square items-center justify-center"
                  style={
                    collected
                      ? { boxShadow: `0 0 8px ${RARITY_COLORS[type.rarity]}40` }
                      : undefined
                  }
                >
                  {collected ? (
                    <>
                      <img
                        src={`/ui/guardi/guardian/${type.asset_key}.png`}
                        alt={type.name}
                        className="pixel-art"
                        style={{ width: 40, height: 40 }}
                      />
                      {count > 1 && (
                        <span
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center font-pixel text-[8px]"
                          style={{ backgroundColor: RARITY_COLORS[type.rarity], color: "#fff", borderRadius: "2px" }}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-pixel text-xl" style={{ color: "var(--theme-placeholder)" }}>?</span>
                  )}
                  {/* 레어도 점 */}
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full"
                    style={{ backgroundColor: RARITY_COLORS[type.rarity], boxShadow: `0 0 4px ${RARITY_COLORS[type.rarity]}` }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelectedType(null)}
        >
          <div className="pixel-panel w-full max-w-[280px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3">
              <div
                className="pixel-input flex h-24 w-24 items-center justify-center"
                style={{ boxShadow: `0 0 20px ${RARITY_COLORS[selectedType.rarity]}40` }}
              >
                <img
                  src={`/ui/guardi/guardian/${selectedType.asset_key}.png`}
                  alt={selectedType.name}
                  className="pixel-art"
                  style={{ width: 52, height: 52 }}
                />
              </div>
              <p className="font-pixel text-sm text-theme">{selectedType.name}</p>
              <span
                className="font-pixel text-xs px-3 py-1"
                style={{ color: RARITY_COLORS[selectedType.rarity], border: `2px solid ${RARITY_COLORS[selectedType.rarity]}`, borderRadius: "4px", textShadow: `0 0 4px ${RARITY_COLORS[selectedType.rarity]}80` }}
              >
                {RARITY_LABELS[selectedType.rarity]}
              </span>
              <div className="w-full space-y-1">
                <div className="flex justify-between font-pixel text-xs">
                  <span className="text-theme-muted">수집 횟수</span>
                  <span className="text-theme">{getCount(selectedType.id)}회</span>
                </div>
                {(() => {
                  const latest = getLatest(selectedType.id);
                  if (!latest) return null;
                  return (
                    <div className="flex justify-between font-pixel text-xs">
                      <span className="text-theme-muted">최초 획득</span>
                      <span className="text-theme">{new Date(latest.acquired_at).toLocaleDateString("ko-KR")}</span>
                    </div>
                  );
                })()}
              </div>
              <button onClick={() => setSelectedType(null)} className="pixel-button mt-1 w-full py-2 font-pixel text-xs text-theme">닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── 아이템 도감 ──
function ItemCollection() {
  const [category, setCategory] = useState("food");
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [collectedIds, setCollectedIds] = useState<Set<number>>(new Set());
  const [summaryMap, setSummaryMap] = useState<Record<string, { collected: number; total: number }>>({});
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [types, collected, summary] = await Promise.all([
      getItemTypes(category),
      getItemCollection(),
      getItemCollectionSummary(),
    ]);
    setItemTypes(types);
    setCollectedIds(collected);

    const map: Record<string, { collected: number; total: number }> = {};
    (summary as any[]).forEach((s: any) => {
      map[s.category] = { collected: Number(s.collected), total: Number(s.total) };
    });
    setSummaryMap(map);
    setLoading(false);
  }, [category]);

  useEffect(() => { loadData(); }, [loadData]);

  const currentSummary = summaryMap[category] || { collected: 0, total: 0 };

  return (
    <>
      {/* 카테고리 서브탭 */}
      <div className="grid grid-cols-4 gap-2">
        {ITEM_CATEGORIES.map((c) => (
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

      <div className="pixel-panel flex-1 overflow-y-auto scrollbar-hide p-4">
        <div className="flex items-center justify-between font-pixel">
          <span className="text-sm text-theme">
            {ITEM_CATEGORIES.find((c) => c.key === category)?.label}
          </span>
          <span className="text-xs text-theme-muted">
            {loading ? "..." : `${currentSummary.collected} / ${currentSummary.total}`}
          </span>
        </div>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <p className="font-pixel text-xs text-theme-muted">로딩 중...</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {itemTypes.map((item) => {
              const collected = collectedIds.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => collected ? setSelectedItem(item) : undefined}
                  className="pixel-input flex aspect-square items-center justify-center"
                  style={{ opacity: collected ? 1 : 0.3 }}
                >
                  <img
                    src={`/ui/items/${item.asset_key}.png`}
                    alt={collected ? item.name : "???"}
                    className="pixel-art"
                    style={{ width: 28, height: 28 }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 아이템 상세 모달 */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelectedItem(null)}
        >
          <div className="pixel-panel w-full max-w-[280px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3">
              <div className="pixel-input flex h-20 w-20 items-center justify-center">
                <img
                  src={`/ui/items/${selectedItem.asset_key}.png`}
                  alt={selectedItem.name}
                  className="pixel-art"
                  style={{ width: 40, height: 40 }}
                />
              </div>
              <p className="font-pixel text-sm text-theme">{selectedItem.name}</p>
              <p className="font-pixel text-xs" style={{ color: "var(--theme-gold)" }}>
                {selectedItem.price}G
              </p>
              {selectedItem.description && (
                <p className="font-pixel text-xs text-theme-muted text-center">
                  {selectedItem.description}
                </p>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="pixel-button mt-1 w-full py-2 font-pixel text-xs text-theme"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
