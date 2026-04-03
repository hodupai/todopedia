"use client";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 프로필 */}
      <div className="pixel-panel p-4">
        <h2 className="font-pixel text-sm text-theme">프로필</h2>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between font-pixel text-xs">
            <span className="text-theme-muted">아이디</span>
            <span className="text-theme">-</span>
          </div>
          <div className="flex justify-between font-pixel text-xs">
            <span className="text-theme-muted">닉네임</span>
            <span className="text-theme">-</span>
          </div>
          <div className="flex justify-between font-pixel text-xs">
            <span className="text-theme-muted">타이틀</span>
            <span className="text-theme">없음</span>
          </div>
        </div>
      </div>

      {/* 일일 목표 설정 */}
      <div className="pixel-panel p-4">
        <h2 className="font-pixel text-sm text-theme">일일 목표</h2>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-pixel text-xs text-theme-muted">하루 투두 개수</span>
          <div className="flex items-center gap-2">
            <button className="pixel-button px-2 py-1 font-pixel text-xs text-theme">-</button>
            <span className="font-pixel text-sm text-theme">5</span>
            <button className="pixel-button px-2 py-1 font-pixel text-xs text-theme">+</button>
          </div>
        </div>
      </div>

      {/* 초대코드 */}
      <div className="pixel-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-sm text-theme">초대코드</h2>
          <span className="font-pixel text-xs text-theme-muted">보유 0장</span>
        </div>
        <div className="mt-3 flex flex-col items-center py-6">
          <span className="text-2xl">💌</span>
          <p className="font-pixel mt-2 text-xs text-theme-muted">
            도감을 채우면 초대코드를 받을 수 있어요
          </p>
        </div>
      </div>

      {/* 출석 */}
      <div className="pixel-panel p-4">
        <h2 className="font-pixel text-sm text-theme">출석 체크</h2>
        <div className="mt-3 flex justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="pixel-input flex h-10 w-10 items-center justify-center"
            >
              <span className="font-pixel text-xs" style={{ color: "var(--theme-placeholder)" }}>
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 로그아웃 */}
      <button className="pixel-button py-2.5 font-pixel text-sm text-theme-muted">
        로그아웃
      </button>
    </div>
  );
}
