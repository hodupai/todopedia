"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <div className="flex min-h-full items-center justify-center bg-cover bg-center bg-no-repeat px-6" style={{ backgroundImage: "url('/ui/bg-forest.webp')" }}>
      <div className="pixel-panel w-full max-w-sm space-y-6 p-8">
        {/* 타이틀 배너 */}
        <div className="flex flex-col items-center gap-3">
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
              TODOPEDIA
            </h1>
          </div>
          <p
            className="text-sm text-[#8b6f4e]"
            style={{ fontFamily: "DungGeunMo, monospace" }}
          >
            투두로 가디를 키워보세요
          </p>
        </div>

        <form action={formAction} className="space-y-4">
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
              placeholder="아이디를 입력하세요"
            />
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
              autoComplete="current-password"
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
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p
          className="text-center text-sm text-[#8b6f4e]"
          style={{ fontFamily: "DungGeunMo, monospace" }}
        >
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-[#5a3a1a] underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
