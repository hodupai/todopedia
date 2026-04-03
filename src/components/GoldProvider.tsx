"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const GoldContext = createContext<{
  gold: number;
  refresh: () => void;
}>({ gold: 0, refresh: () => {} });

export function useGold() {
  return useContext(GoldContext);
}

export default function GoldProvider({ children }: { children: React.ReactNode }) {
  const [gold, setGold] = useState(0);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("gold")
      .eq("id", user.id)
      .single();

    if (data) setGold(data.gold);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <GoldContext.Provider value={{ gold, refresh }}>
      {children}
    </GoldContext.Provider>
  );
}
