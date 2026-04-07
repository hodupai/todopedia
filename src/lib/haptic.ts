// 햅틱 피드백 유틸 (모바일에서만 동작, 데스크톱은 no-op)
// navigator.vibrate가 없거나 사용자가 prefers-reduced-motion이면 동작 안 함.

function canVibrate(): boolean {
  if (typeof navigator === "undefined" || !navigator.vibrate) return false;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  return true;
}

export function hapticTap() {
  if (!canVibrate()) return;
  navigator.vibrate(15);
}

export function hapticSuccess() {
  if (!canVibrate()) return;
  navigator.vibrate([20, 40, 20]);
}

export function hapticCelebrate() {
  if (!canVibrate()) return;
  navigator.vibrate([30, 60, 30, 60, 80]);
}

export function hapticError() {
  if (!canVibrate()) return;
  navigator.vibrate([40, 30, 40]);
}
