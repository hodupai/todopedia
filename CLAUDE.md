# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev -- -p 4000   # dev server (port 3000 is occupied)
npm run build            # production build
npm run lint             # eslint
```

Supabase migrations are in `supabase/migrations/` and applied via the Supabase MCP tool `mcp__supabase__apply_migration`.

## Architecture

**TODOPEDIA** — 투두+다마고치 게이미피케이션 웹앱. 유저가 투두를 완료하면 "가디"를 성장시키고, 골드를 벌어 상점에서 테마/아이템을 구매.

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **Supabase** (PostgreSQL + Auth + RLS) — 인증은 `username@todopedia.app` 가짜 이메일로 아이디/비밀번호 로그인 구현
- `@/*` path alias → `./src/*`

### Route Groups

- `(auth)` — 로그인/회원가입 (Header/BottomNav 없음, 하드코딩된 Paper 테마)
- `(app)` — 인증된 사용자 전용 (Header + BottomNav + ThemeProvider + GoldProvider + ToastProvider)
- 미들웨어(`src/lib/supabase/middleware.ts`)가 비인증→`/login` 리다이렉트, `/api/` 경로는 public

### Theme System

CSS 변수 기반. `ThemeProvider`가 `:root`에 `--theme-*` 변수를 동적 세팅.

- 테마 정의: `src/lib/themes.ts` (ThemeConfig 인터페이스)
- 에셋: `public/ui/{theme}/` (9-slice PNG → `border-image`로 사용)
- 기본값: `globals.css`의 `:root`에 paper 테마 하드코딩
- 새 테마 추가 시: themes.ts에 정의 + `public/ui/{theme}/`에 에셋 복사

UI 클래스: `pixel-panel`, `pixel-input`, `pixel-button` (9-slice border-image), `font-pixel` (둥근모꼴), `text-theme`, `text-theme-muted`, `bg-theme`, `pixel-art` (image-rendering: pixelated)

### TODO System

3가지 투두 타입:
- **일반(normal)**: 체크 토글로 완료
- **루프(loop)**: n회 카운트 달성으로 완료, 확인 모달 있음
- **습관(habit)**: 완료 개념 없음, +/- 카운트 기록 (positive/negative). 항상 `repeat_type='daily'`

골드 경제:
- 투두/루프 완료: 200G (일일 목표 개수까지만 지급)
- 습관: positive +100G, negative +50G (일일 상한 1,000G)
- `add_gold` RPC로 증감, `GoldProvider`가 헤더에 실시간 표시

반복 옵션: `repeat_type` (daily/weekly/monthly) + `repeat_days` (요일 또는 날짜 배열). `ensureDailyRecords()`가 접속 시 오늘치 레코드 자동 생성.

### Asset Convention

- 유료 에셋 원본: `asset/` (gitignored)
- 사용할 에셋만 `public/ui/`로 복사
- 아이콘: `public/ui/icons/` (16px 픽셀아트, `pixel-art` 클래스로 확대)
- 배경: `public/ui/bg-*.jpg`

### Key Constraints

- PC 최대 너비 480px, 모바일 우선
- 일일 목표: 1/5/10/20 중 선택 (0=미선택, 모달로 강제)
- 초대코드제: 가입 시 3장 발급, `handle_signup` RPC 처리
- 닉네임: 랜덤 생성 (형용사+동물), `is_nickname_available` RPC로 중복 체크
