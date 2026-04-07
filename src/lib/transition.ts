// 네이티브 View Transitions API 헬퍼.
// Chrome 111+/Edge 111+/Safari 18+ 지원. 미지원 브라우저는 그냥 즉시 navigation.
// React 19/Next 16의 unstable_ViewTransition 컴포넌트는 still experimental이라
// 안정성을 위해 브라우저 네이티브 API를 직접 사용.

type RouterLike = { push: (href: string) => void };

export function startPageTransition(router: RouterLike, href: string) {
  if (typeof document === "undefined") {
    router.push(href);
    return;
  }

  // prefers-reduced-motion 존중
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    router.push(href);
    return;
  }

  // startViewTransition 미지원 브라우저는 즉시 이동
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };
  if (typeof doc.startViewTransition !== "function") {
    router.push(href);
    return;
  }

  doc.startViewTransition(() => {
    router.push(href);
  });
}
