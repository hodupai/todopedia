"use client";

import Link from "next/link";
import { useActionState, useState, useCallback } from "react";
import { signup } from "../actions";
import { generateNickname } from "@/lib/nickname";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, null);
  const [nickname, setNickname] = useState("");
  const [rolling, setRolling] = useState(false);

  const rollNickname = useCallback(async () => {
    setRolling(true);
    const supabase = createClient();

    for (let i = 0; i < 10; i++) {
      const candidate = generateNickname();
      const { data } = await supabase.rpc("is_nickname_available", {
        p_nickname: candidate,
      });
      if (data) {
        setNickname(candidate);
        setRolling(false);
        return;
      }
    }

    setNickname(generateNickname());
    setRolling(false);
  }, []);

  return (
    <div className="flex min-h-full items-center justify-center bg-cover bg-center bg-no-repeat px-6 py-8" style={{ backgroundImage: "url('/ui/bg-forest.webp')" }}>
      <div className="pixel-panel w-full max-w-sm space-y-5 p-8">
        {/* 타이틀 배너 */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex items-center justify-center">
            <img
              src="/ui/paper/banner.png"
              alt=""
              className="pixel-art h-12 w-56"
            />
            <h1
              className="absolute inset-0 flex items-center justify-center text-xl tracking-wider text-[#5a3a1a]"
              style={{ fontFamily: "DungGeunMo, monospace" }}
            >
              회원가입
            </h1>
          </div>
          <p
            className="text-sm text-[#8b6f4e]"
            style={{ fontFamily: "DungGeunMo, monospace" }}
          >
            초대코드가 필요합니다
          </p>
        </div>

        <form action={formAction} className="space-y-3">
          <div>
            <label
              htmlFor="inviteCode"
              className="mb-1 block text-sm text-[#5a3a1a]"
              style={{ fontFamily: "DungGeunMo, monospace" }}
            >
              초대코드
            </label>
            <input
              id="inviteCode"
              name="inviteCode"
              type="text"
              required
              className="pixel-input block w-full bg-transparent px-3 py-2.5 text-sm uppercase text-[#3a2a10] placeholder:normal-case placeholder:text-[#b8a080] focus:outline-none"
              style={{ fontFamily: "DungGeunMo, monospace" }}
              placeholder="ABC-1234"
            />
          </div>

          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm text-[#5a3a1a]"
              style={{ fontFamily: "DungGeunMo, monospace" }}
            >
              아이디
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              className="pixel-input block w-full bg-transparent px-3 py-2.5 text-sm text-[#3a2a10] placeholder:text-[#b8a080] focus:outline-none"
              style={{ fontFamily: "DungGeunMo, monospace" }}
              placeholder="영문, 숫자 조합"
            />
          </div>

          <div>
            <label
              htmlFor="nickname"
              className="mb-1 block text-sm text-[#5a3a1a]"
              style={{ fontFamily: "DungGeunMo, monospace" }}
            >
              닉네임
            </label>
            <div className="flex gap-2">
              <input
                id="nickname"
                name="nickname"
                type="text"
                required
                readOnly
                value={nickname}
                className="pixel-input block w-full bg-transparent px-3 py-2.5 text-sm text-[#3a2a10] placeholder:text-[#b8a080] focus:outline-none"
                style={{ fontFamily: "DungGeunMo, monospace" }}
                placeholder="주사위를 굴려보세요"
              />
              <button
                type="button"
                onClick={rollNickname}
                disabled={rolling}
                className="pixel-button shrink-0 px-3 py-2.5 text-lg transition-opacity disabled:opacity-50"
                title="랜덤 닉네임 생성"
              >
                🎲
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm text-[#5a3a1a]"
              style={{ fontFamily: "DungGeunMo, monospace" }}
            >
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="pixel-input block w-full bg-transparent px-3 py-2.5 text-sm text-[#3a2a10] placeholder:text-[#b8a080] focus:outline-none"
              style={{ fontFamily: "DungGeunMo, monospace" }}
              placeholder="6자 이상"
            />
          </div>

          {state?.error && (
            <p className="text-center text-sm text-red-600">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="pixel-button w-full py-2.5 text-base font-semibold text-[#5a3a1a] transition-opacity disabled:opacity-50"
            style={{ fontFamily: "DungGeunMo, monospace" }}
          >
            {pending ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <p
          className="text-center text-sm text-[#8b6f4e]"
          style={{ fontFamily: "DungGeunMo, monospace" }}
        >
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-[#5a3a1a] underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
