"use client";

export default function VillagePage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 담벼락 */}
      <div className="pixel-panel flex-1 p-4">
        <h2 className="font-pixel text-sm text-theme">담벼락</h2>
        <div className="mt-4 flex flex-col items-center justify-center py-12">
          <span className="text-3xl">🏘️</span>
          <p className="font-pixel mt-2 text-sm text-theme-muted">
            아직 아무도 없어요
          </p>
        </div>
      </div>

      {/* 상점 바로가기 */}
      <div className="grid grid-cols-3 gap-3">
        <button className="pixel-button flex flex-col items-center gap-1 py-3">
          <span className="text-xl">🎨</span>
          <span className="font-pixel text-xs text-theme">테마샵</span>
        </button>
        <button className="pixel-button flex flex-col items-center gap-1 py-3">
          <span className="text-xl">🧸</span>
          <span className="font-pixel text-xs text-theme">가디용품</span>
        </button>
        <button className="pixel-button flex flex-col items-center gap-1 py-3">
          <span className="text-xl">🧪</span>
          <span className="font-pixel text-xs text-theme">마법용품</span>
        </button>
      </div>
    </div>
  );
}
