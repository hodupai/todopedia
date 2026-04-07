"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useGold } from "./GoldProvider";

const PAGE_TITLES: Record<string, string> = {
  "/village": "마을",
  "/collection": "도감",
  "/todo": "TODO",
  "/guardian": "가디",
  "/settings": "설정",
};

// 골드 카운트업 애니메이션 (값 변경 시 자연스럽게 흘러가게)
function useAnimatedNumber(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(fromRef.current + (target - fromRef.current) * eased);
      setValue(next);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

type GoldPop = { id: number; delta: number };

export default function Header() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "TODOPEDIA";
  const { gold, streak } = useGold();
  const animatedGold = useAnimatedNumber(gold);

  // 골드 변화를 감지해 +N / -N 팝업 생성
  const prevGoldRef = useRef(gold);
  const [pops, setPops] = useState<GoldPop[]>([]);
  const popIdRef = useRef(0);

  useEffect(() => {
    const delta = gold - prevGoldRef.current;
    prevGoldRef.current = gold;
    if (delta === 0) return;
    const id = ++popIdRef.current;
    setPops((p) => [...p, { id, delta }]);
    const t = setTimeout(() => {
      setPops((p) => p.filter((x) => x.id !== id));
    }, 1100);
    return () => clearTimeout(t);
  }, [gold]);

  return (
    <header
      className="relative flex h-14 shrink-0 items-center justify-between border-b px-4"
      style={{ borderColor: "var(--theme-placeholder)" }}
    >
      {/* 좌측: 앱 아이콘 + streak */}
      <div className="flex items-center gap-2">
        <div
          className="pixel-button flex h-8 w-8 items-center justify-center text-xs font-bold"
          style={{ color: "var(--theme-header-text)" }}
        >
          TD
        </div>
        {streak > 0 && (
          <div
            className="font-pixel flex items-center gap-0.5 text-xs"
            style={{ color: "var(--theme-header-text)" }}
            title={`연속 ${streak}일`}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>🔥</span>
            <span>{streak}</span>
          </div>
        )}
      </div>

      {/* 중앙: 메뉴명 */}
      <h1
        className="font-pixel text-xl font-bold"
        style={{ color: "var(--theme-header-text)" }}
      >
        {title}
      </h1>

      {/* 우측: 골드 + 변동 팝업 */}
      <div className="relative">
        <div
          className="font-pixel flex items-center gap-1 text-base"
          style={{ color: "var(--theme-gold)" }}
        >
          <img src="/ui/icons/gold.png" alt="골드" className="pixel-art h-6 w-6" />
          <span>{animatedGold.toLocaleString()}</span>
        </div>
        {/* 팝업 — 골드 위로 떠오르며 페이드 */}
        <div className="pointer-events-none absolute inset-0 flex justify-end">
          {pops.map((p) => (
            <span
              key={p.id}
              className="font-pixel absolute right-0 text-xs gold-pop"
              style={{
                top: 0,
                color: p.delta > 0 ? "var(--theme-gold)" : "var(--theme-accent)",
                textShadow: "0 0 4px rgba(0,0,0,0.6)",
              }}
            >
              {p.delta > 0 ? `+${p.delta}` : p.delta}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
