// 투두 완료 시 가디 아이콘으로 날아가는 "+1 성장" 파티클.
// React state 없이 DOM 직접 조작으로 가볍게 구현.

export function spawnGrowthParticle(fromX: number, fromY: number) {
  if (typeof document === "undefined") return;

  const target = document.querySelector('a[href="/guardian"]');
  if (!target) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const targetRect = target.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  const el = document.createElement("div");
  el.textContent = "+1";
  el.className = "growth-particle";
  el.style.left = fromX + "px";
  el.style.top = fromY + "px";
  el.style.setProperty("--dx", targetX - fromX + "px");
  el.style.setProperty("--dy", targetY - fromY + "px");
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 1000);
}

// 투두 ID로 화면상의 요소를 찾아 그 위치에서 파티클 생성
export function spawnParticleFromTodoId(todoId: string) {
  if (typeof document === "undefined") return;
  const el = document.querySelector(`[data-todo-id="${todoId}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  spawnGrowthParticle(r.left + 24, r.top + r.height / 2);
}
