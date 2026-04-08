"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari
        // @ts-expect-error legacy
        window.navigator.standalone === true
    );
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        // @ts-expect-error legacy
        !window.MSStream
    );

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (isStandalone) return null;

  // Android/Chromium: 네이티브 프롬프트 사용 가능
  if (deferred) {
    return (
      <button
        onClick={async () => {
          await deferred.prompt();
          const { outcome } = await deferred.userChoice;
          if (outcome === "accepted") setDeferred(null);
        }}
        className="pixel-button py-2.5 font-pixel text-xs text-theme"
      >
        📱 홈 화면에 추가
      </button>
    );
  }

  // iOS Safari: 안내 모달
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="pixel-button py-2.5 font-pixel text-xs text-theme"
        >
          📱 홈 화면에 추가
        </button>
        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="pixel-panel w-full max-w-[320px] space-y-3 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-pixel text-sm text-theme text-center">
                홈 화면에 추가
              </p>
              <p className="font-pixel text-xs text-theme-muted leading-relaxed">
                Safari 하단의 <span className="text-theme">공유 버튼 ⎋</span>을
                누른 뒤<br />
                <span className="text-theme">"홈 화면에 추가"</span>를
                선택해주세요.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="pixel-button w-full py-2 font-pixel text-xs text-theme-muted"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 그 외 (데스크톱 Safari, 미지원 브라우저): 표시 안 함
  return null;
}
