"use client";

export default function GuardianPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 가디 상태 */}
      <div className="pixel-panel flex flex-col items-center gap-3 p-6">
        <div className="pixel-input flex h-32 w-32 items-center justify-center">
          <span className="text-5xl">🥚</span>
        </div>
        <p className="font-pixel text-sm text-theme">아직 가디가 없어요</p>
        <p className="font-pixel text-xs text-theme-muted">
          TODO를 시작하면 알을 받을 수 있어요
        </p>
      </div>

      {/* 돌보기 버튼 */}
      <div className="pixel-panel p-4">
        <h2 className="font-pixel text-sm text-theme">돌보기</h2>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <button className="pixel-button flex flex-col items-center gap-1 py-3" disabled>
            <span className="text-xl">🍞</span>
            <span className="font-pixel text-xs text-theme-muted">음식</span>
          </button>
          <button className="pixel-button flex flex-col items-center gap-1 py-3" disabled>
            <span className="text-xl">⚽</span>
            <span className="font-pixel text-xs text-theme-muted">놀이</span>
          </button>
          <button className="pixel-button flex flex-col items-center gap-1 py-3" disabled>
            <span className="text-xl">🛁</span>
            <span className="font-pixel text-xs text-theme-muted">위생</span>
          </button>
          <button className="pixel-button flex flex-col items-center gap-1 py-3" disabled>
            <span className="text-xl">😴</span>
            <span className="font-pixel text-xs text-theme-muted">수면</span>
          </button>
        </div>
      </div>

      {/* 성장 정보 */}
      <div className="pixel-panel p-4">
        <h2 className="font-pixel text-sm text-theme">성장 정보</h2>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between font-pixel text-xs">
            <span className="text-theme-muted">남은 기간</span>
            <span className="text-theme">-</span>
          </div>
          <div className="flex justify-between font-pixel text-xs">
            <span className="text-theme-muted">성장치</span>
            <span className="text-theme">-</span>
          </div>
        </div>
      </div>
    </div>
  );
}
