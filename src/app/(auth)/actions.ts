"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function toFakeEmail(username: string) {
  return `${username}@todopedia.app`;
}

export async function login(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "아이디와 비밀번호를 입력해주세요." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: toFakeEmail(username),
    password,
  });

  if (error) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  redirect("/todo");
}

export async function signup(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const nickname = formData.get("nickname") as string;
  const inviteCode = formData.get("inviteCode") as string;

  if (!username || !password || !nickname || !inviteCode) {
    return { error: "모든 항목을 입력해주세요." };
  }

  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  // 아이디 중복 확인
  const { data: usernameAvailable } = await supabase.rpc(
    "is_username_available",
    { p_username: username }
  );
  if (!usernameAvailable) {
    return { error: "이미 사용 중인 아이디입니다." };
  }

  // 닉네임 중복 확인
  const { data: nicknameAvailable } = await supabase.rpc(
    "is_nickname_available",
    { p_nickname: nickname }
  );
  if (!nicknameAvailable) {
    return { error: "이미 사용 중인 닉네임입니다." };
  }

  // 초대코드 검증
  const { data: inviteData } = await supabase
    .from("invite_codes")
    .select("id")
    .eq("code", inviteCode.toUpperCase())
    .is("used_by", null)
    .single();

  if (!inviteData) {
    return { error: "유효하지 않은 초대코드입니다." };
  }

  // Supabase Auth 회원가입
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: toFakeEmail(username),
    password,
  });

  if (authError || !authData.user) {
    return { error: "회원가입에 실패했습니다. 다시 시도해주세요." };
  }

  // handle_signup RPC로 프로필 생성 + 초대코드 처리
  const { error: signupError } = await supabase.rpc("handle_signup", {
    p_user_id: authData.user.id,
    p_username: username,
    p_nickname: nickname,
    p_invite_code: inviteCode.toUpperCase(),
  });

  if (signupError) {
    return { error: "프로필 생성에 실패했습니다. 관리자에게 문의해주세요." };
  }

  redirect("/todo");
}
