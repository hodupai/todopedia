export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-theme p-6 text-center">
      <p className="font-pixel text-base text-theme">오프라인이에요</p>
      <p className="font-pixel text-xs text-theme-muted">
        인터넷 연결을 확인하고 다시 시도해주세요.
      </p>
    </div>
  );
}
