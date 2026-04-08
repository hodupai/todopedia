import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/api/",
  "/sw.js",
  "/manifest.webmanifest",
  "/offline",
  "/icons/",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 미들웨어는 매 요청마다 호출되므로 getUser() (HTTP) 대신 getSession() (쿠키 디코드)으로 처리.
  // 토큰 위조 방어는 RLS가 담당하므로 미들웨어는 "세션 쿠키 존재 여부"만 체크해도 충분.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // 비인증 → 로그인으로
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 인증 완료 → 로그인/회원가입 페이지 접근 차단
  if (user && isPublic && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/todo";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
