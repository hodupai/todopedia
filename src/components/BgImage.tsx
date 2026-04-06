"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function BgImage() {
  const { bgKey } = useTheme();

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundImage: `url(/ui/${bgKey}.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.15,
      }}
    />
  );
}
