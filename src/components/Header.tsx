"use client";

import { usePathname } from "next/navigation";
import { useGold } from "./GoldProvider";

const PAGE_TITLES: Record<string, string> = {
  "/village": "마을",
  "/collection": "도감",
  "/todo": "TODO",
  "/guardian": "가디",
  "/settings": "설정",
};

export default function Header() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "TODOPEDIA";
  const { gold } = useGold();

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b px-4"
      style={{ borderColor: "var(--theme-placeholder)" }}
    >
      {/* 좌측: 앱 아이콘 */}
      <div
        className="pixel-button flex h-8 w-8 items-center justify-center text-xs font-bold"
        style={{ color: "var(--theme-header-text)" }}
      >
        TD
      </div>

      {/* 중앙: 메뉴명 */}
      <h1
        className="font-pixel text-xl font-bold"
        style={{ color: "var(--theme-header-text)" }}
      >
        {title}
      </h1>

      {/* 우측: 골드 */}
      <div
        className="font-pixel flex items-center gap-1 text-base"
        style={{ color: "var(--theme-gold)" }}
      >
        <img src="/ui/icons/gold.png" alt="골드" className="pixel-art h-6 w-6" />
        <span>{gold.toLocaleString()}</span>
      </div>
    </header>
  );
}
