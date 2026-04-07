"use client";

import { useState, useCallback, createContext, useContext } from "react";

type ToastPosition = "bottom-right" | "top-center";

type ToastMessage = {
  id: number;
  text: string;
  subText?: string;
  position: ToastPosition;
};

const ToastContext = createContext<{
  show: (text: string, subText?: string, position?: ToastPosition) => void;
}>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((text: string, subText?: string, position: ToastPosition = "bottom-right") => {
    setToasts((prev) => {
      // dedupe: 같은 텍스트의 토스트가 이미 있으면 새로 추가하지 않음
      if (prev.some((t) => t.text === text && t.subText === subText && t.position === position)) {
        return prev;
      }
      // queue 상한: 최대 3개까지만 동시 표시 (가장 오래된 것 제거)
      const id = nextId++;
      const next = [...prev, { id, text, subText, position }];
      const trimmed = next.length > 3 ? next.slice(next.length - 3) : next;
      setTimeout(() => {
        setToasts((p) => p.filter((t) => t.id !== id));
      }, 2000);
      return trimmed;
    });
  }, []);

  const bottomRight = toasts.filter((t) => t.position === "bottom-right");
  const topCenter = toasts.filter((t) => t.position === "top-center");

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {/* 우측 하단 토스트 */}
      {bottomRight.length > 0 && (
        <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
          {bottomRight.map((t) => (
            <div
              key={t.id}
              className="pixel-panel animate-fade-in pointer-events-auto px-5 py-3 text-center"
            >
              <p className="font-pixel text-sm text-theme">{t.text}</p>
              {t.subText && (
                <p className="font-pixel mt-0.5 text-xs text-theme-muted">{t.subText}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 상단 중앙 토스트 */}
      {topCenter.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2">
          {topCenter.map((t) => (
            <div
              key={t.id}
              className="pixel-panel animate-fade-in-down pointer-events-auto px-6 py-3 text-center"
            >
              <p className="font-pixel text-base text-theme">{t.text}</p>
              {t.subText && (
                <p className="font-pixel mt-0.5 text-sm text-theme-muted">{t.subText}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
