import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * 세션 쿠키에서 user를 꺼낸다 (네트워크 호출 없음).
 * 미들웨어가 매 요청마다 supabase.auth.getUser()로 검증하므로
 * 서버 액션/페이지에서는 getSession()으로 충분하다.
 *
 * supabase.auth.getUser()는 매번 /auth/v1/user에 HTTP 요청하지만
 * getSession()은 쿠키의 JWT를 로컬에서 디코드만 한다.
 */
export async function getUserFromSession(
  supabase: SupabaseClient
): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}
