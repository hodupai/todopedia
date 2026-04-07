"use client";

import { createContext, useContext, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserFromSession } from "@/lib/supabase/auth";

const GoldContext = createContext<{
  gold: number;
  refresh: () => void;
  setGold: Dispatch<SetStateAction<number>>;
}>({ gold: 0, refresh: () => {}, setGold: () => {} });

export function useGold() {
  return useContext(GoldContext);
}

export default function GoldProvider({
  initialGold = 0,
  children,
}: {
  initialGold?: number;
  children: React.ReactNode;
}) {
  const [gold, setGold] = useState(initialGold);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const user = await getUserFromSession(supabase);
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("gold")
      .eq("id", user.id)
      .single();

    if (data) setGold(data.gold);
  }, []);

  return (
    <GoldContext.Provider value={{ gold, refresh, setGold }}>
      {children}
    </GoldContext.Provider>
  );
}
