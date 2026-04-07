import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service role 클라이언트. RLS를 우회하므로 **반드시 server-side에서만**, 그리고
 * 호출 전에 현재 사용자가 admin인지 검증한 다음에만 사용해야 한다.
 *
 * NEVER 클라이언트 컴포넌트에서 import하지 말 것.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL/SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 현재 로그인된 사용자가 admin인지 확인. server action/page에서 호출.
 * 검증 실패 시 false 반환. 사용처에서 redirect나 401 처리 필요.
 */
import { createClient } from "./server";
import { getUserFromSession } from "./auth";

export async function requireAdmin(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return null;

  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;
  return { userId: user.id };
}
