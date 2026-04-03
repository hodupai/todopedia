"use client";

import { useState } from "react";

const TABS = ["가디 도감", "아이템 도감"] as const;

export default function CollectionPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("가디 도감");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 서브탭 */}
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

      {/* 도감 그리드 */}
      <div className="pixel-panel flex-1 p-4">
        <div className="flex items-center justify-between font-pixel">
          <span className="text-sm text-theme">{tab}</span>
          <span className="text-xs text-theme-muted">0 / 0</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="pixel-input flex aspect-square items-center justify-center"
            >
              <span className="text-xl" style={{ color: "var(--theme-placeholder)" }}>?</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
