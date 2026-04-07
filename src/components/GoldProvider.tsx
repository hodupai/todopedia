"use client";

import { createContext, useContext, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserFromSession } from "@/lib/supabase/auth";

// 헤더에 표시되는 데이터(gold + streak)를 함께 관리.
// 이름은 GoldProvider이지만 실질적으로는 헤더 데이터 컨텍스트.
const GoldContext = createContext<{
  gold: number;
  setGold: Dispatch<SetStateAction<number>>;
  streak: number;
  setStreak: Dispatch<SetStateAction<number>>;
  refresh: () => void;
}>({
  gold: 0,
  setGold: () => {},
  streak: 0,
  setStreak: () => {},
  refresh: () => {},
});

export function useGold() {
  return useContext(GoldContext);
}

export default function GoldProvider({
  initialGold = 0,
  initialStreak = 0,
  children,
}: {
  initialGold?: number;
  initialStreak?: number;
  children: React.ReactNode;
}) {
  const [gold, setGold] = useState(initialGold);
  const [streak, setStreak] = useState(initialStreak);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const user = await getUserFromSession(supabase);
    if (!user) return;

    const [{ data: profile }, { data: streakData }] = await Promise.all([
      supabase.from("profiles").select("gold").eq("id", user.id).single(),
      supabase.rpc("get_user_streak", { p_user_id: user.id }),
    ]);

    if (profile) setGold(profile.gold);
    if (typeof streakData === "number") setStreak(streakData);
  }, []);

  return (
    <GoldContext.Provider value={{ gold, setGold, streak, setStreak, refresh }}>
      {children}
    </GoldContext.Provider>
  );
}
